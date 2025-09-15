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
};

/**
 * Starts a Windows REPL debugger.
 */
declare function startDebugger(options?: DebuggerOptions): void;

export = startDebugger;