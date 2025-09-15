import * as net from 'net';
import * as repl from 'repl';
import * as util from 'util';
import * as domain from 'domain';
import { spawn } from 'child_process';

/**
 * Configuration options for the Windows debugger
 */
export interface WindowsDebuggerOptions {
  /** The window title for the PowerShell debugger session */
  title?: string;
  /** The default return value when pressing enter without typing a command */
  default?: any;
  /** An eval function used to evaluate REPL input */
  eval?: (command: string) => any;
}

/**
 * Internal configuration with default values applied
 */
interface InternalOptions {
  title: string;
  default: any;
  eval: (command: string) => any;
}

/**
 * PowerShell command builder for creating the debugger session
 */
class PowerShellCommandBuilder {
  private readonly title: string;
  private readonly port: number;

  constructor(title: string, port: number) {
    this.title = title;
    this.port = port;
  }

  /**
   * Escapes single quotes in PowerShell strings by doubling them
   */
  private escapePowerShellString(str: string): string {
    return str.replace(/'/g, "''");
  }

  /**
   * Builds the Node.js command that will run inside PowerShell
   */
  private buildNodeCommand(): string {
    const nodeScript = `
      const net = require('net');
      const socket = net.connect(${this.port}, 'localhost');
      socket.pipe(process.stdout);
      process.stdin.pipe(socket);
    `.replace(/\n/g, ' ').replace(/'/g, "''");

    return `node -e '${nodeScript}'`;
  }

  /**
   * Builds the complete PowerShell command array
   */
  public buildCommand(): string[] {
    const escapedTitle = this.escapePowerShellString(this.title);
    const nodeCommand = this.buildNodeCommand();

    return [
      '-NoExit',
      '-Command',
      `$host.UI.RawUI.WindowTitle='${escapedTitle}'; ${nodeCommand}; exit`
    ];
  }
}

/**
 * REPL server manager for handling socket connections and evaluation
 */
class ReplServerManager {
  private readonly options: InternalOptions;
  private server: net.Server | null = null;

  constructor(options: InternalOptions) {
    this.options = options;
  }

  /**
   * Creates and configures a REPL instance for a socket connection
   */
  private createReplInstance(socket: net.Socket): repl.REPLServer {
    return repl.start({
      input: socket,
      output: socket,
      terminal: false,
      prompt: '> ',
      eval: this.createEvalFunction(),
      writer: this.createWriterFunction()
    });
  }

  /**
   * Creates the eval function for the REPL with error handling
   */
  private createEvalFunction(): repl.REPLEval {
    return (command: string, _context: any, _filename: string, callback: (err: Error | null, result?: any) => void) => {
      try {
        const trimmedCommand = command.trim();
        const result = trimmedCommand ? this.options.eval(command) : this.options.default;
        callback(null, result);
      } catch (error) {
        callback(error as Error);
      }
    };
  }

  /**
   * Creates the writer function for formatting REPL output
   */
  private createWriterFunction(): (output: any) => string {
    return (output: any): string => {
      return util.inspect(output, { colors: true, depth: null });
    };
  }

  /**
   * Starts the TCP server and returns a promise with the port number
   */
  public async startServer(): Promise<number> {
    return new Promise((resolve, reject) => {
      try {
        this.server = net.createServer((socket) => {
          this.createReplInstance(socket);
        });

        this.server.listen(0, () => {
          if (!this.server) {
            reject(new Error('Server failed to start'));
            return;
          }
          
          const address = this.server.address();
          if (typeof address === 'string' || !address) {
            reject(new Error('Invalid server address'));
            return;
          }

          resolve(address.port);
        });

        this.server.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Closes the server if it's running
   */
  public close(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}

/**
 * Windows platform validator
 */
class PlatformValidator {
  /**
   * Validates that the current platform is Windows
   */
  public static validateWindows(): void {
    if (process.platform !== 'win32') {
      throw new Error('This module only works on Windows.');
    }
  }
}

/**
 * PowerShell process spawner
 */
class PowerShellSpawner {
  /**
   * Spawns a PowerShell process with the given command
   */
  public static spawn(command: string[]): void {
    spawn('powershell.exe', command, {
      cwd: process.cwd(),
      shell: true,
      detached: true,
      stdio: 'ignore'
    });
  }
}

/**
 * Default configuration values
 */
const DEFAULT_OPTIONS: InternalOptions = {
  title: 'Windows Debugger',
  default: undefined,
  eval: eval
};

/**
 * Applies default values to the provided options
 */
function applyDefaults(options: WindowsDebuggerOptions = {}): InternalOptions {
  return {
    title: options.title ?? DEFAULT_OPTIONS.title,
    default: options.default ?? DEFAULT_OPTIONS.default,
    eval: options.eval ?? DEFAULT_OPTIONS.eval
  };
}

/**
 * Creates a domain for error handling
 */
function createErrorDomain(): domain.Domain {
  const replDomain = domain.create();
  replDomain.on('error', () => {
    // Suppress domain errors to avoid crashing the main process
  });
  return replDomain;
}

/**
 * Main entry point for the Windows debugger
 * Opens a Windows terminal window with a REPL for debugging
 */
export default function windowsDebugger(options: WindowsDebuggerOptions = {}): void {
  const replDomain = createErrorDomain();
  
  replDomain.run(async () => {
    try {
      // Validate platform
      PlatformValidator.validateWindows();

      // Apply default configuration
      const internalOptions = applyDefaults(options);

      // Start the REPL server
      const replManager = new ReplServerManager(internalOptions);
      const port = await replManager.startServer();

      // Build PowerShell command
      const commandBuilder = new PowerShellCommandBuilder(internalOptions.title, port);
      const powershellCommand = commandBuilder.buildCommand();

      // Spawn PowerShell process
      PowerShellSpawner.spawn(powershellCommand);

    } catch (error) {
      console.error('Failed to start Windows debugger:', error);
      throw error;
    }
  });
}

// For CommonJS compatibility
module.exports = windowsDebugger;
module.exports.default = windowsDebugger;