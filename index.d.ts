export interface DebuggerOptions {
  /**
   * The window title for the debugger.
   * @default "Windows Debugger"
   */
  title?: string;

  /**
   * The default value returned when the command is empty.
   */
  default?: any;

  /**
   * A custom eval function to run commands.
   * @default global eval
   */
  eval?: (command: string) => any;

  /**
   * An optional password required to authenticate
   * the REPL session before use.
   * If omitted, a random UUID is generated internally.
   */
  password?: string;
};

/**
 * Starts a Windows REPL debugger.
 */
declare function startDebugger(options?: DebuggerOptions): void;

export = startDebugger;