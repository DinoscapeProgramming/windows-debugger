namespace WindowsDebugger;

/// <summary>
/// Configuration options for the Windows debugger
/// </summary>
public class WindowsDebuggerOptions
{
    /// <summary>
    /// The window title for the PowerShell debugger session
    /// </summary>
    public string? Title { get; set; }

    /// <summary>
    /// The default return value when pressing enter without typing a command
    /// </summary>
    public object? Default { get; set; }

    /// <summary>
    /// An eval function used to evaluate REPL input
    /// </summary>
    public Func<string, object?>? Eval { get; set; }
}

/// <summary>
/// Internal configuration with default values applied
/// </summary>
internal class InternalOptions
{
    public string Title { get; init; } = string.Empty;
    public object? Default { get; init; }
    public Func<string, object?> Eval { get; init; } = _ => null;
}