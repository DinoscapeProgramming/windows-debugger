using Microsoft.CodeAnalysis.CSharp.Scripting;
using Microsoft.CodeAnalysis.Scripting;

namespace WindowsDebugger;

/// <summary>
/// Main entry point for the Windows debugger
/// Opens a Windows terminal window with a REPL for debugging
/// </summary>
public static class WindowsDebugger
{
    /// <summary>
    /// Default configuration values
    /// </summary>
    private static readonly InternalOptions DefaultOptions = new()
    {
        Title = "Windows Debugger",
        Default = null,
        Eval = DefaultEval
    };

    /// <summary>
    /// Main entry point for the Windows debugger
    /// Opens a Windows terminal window with a REPL for debugging
    /// </summary>
    /// <param name="options">Configuration options</param>
    public static void Start(WindowsDebuggerOptions? options = null)
    {
        _ = Task.Run(async () =>
        {
            try
            {
                // Validate platform
                PlatformValidator.ValidateWindows();

                // Apply default configuration
                var internalOptions = ApplyDefaults(options ?? new WindowsDebuggerOptions());

                // Start the REPL server
                using var replManager = new ReplServerManager(internalOptions);
                var port = await replManager.StartServerAsync();

                // Build PowerShell command
                var commandBuilder = new PowerShellCommandBuilder(internalOptions.Title, port);
                var powershellCommand = commandBuilder.BuildCommand();

                // Spawn PowerShell process
                PowerShellSpawner.Spawn(powershellCommand);

                // Keep the server running
                await Task.Delay(-1);
            }
            catch (Exception error)
            {
                Console.Error.WriteLine($"Failed to start Windows debugger: {error.Message}");
                throw;
            }
        });
    }

    /// <summary>
    /// Applies default values to the provided options
    /// </summary>
    private static InternalOptions ApplyDefaults(WindowsDebuggerOptions options)
    {
        return new InternalOptions
        {
            Title = options.Title ?? DefaultOptions.Title,
            Default = options.Default ?? DefaultOptions.Default,
            Eval = options.Eval ?? DefaultOptions.Eval
        };
    }

    /// <summary>
    /// Default eval function using C# script evaluation
    /// </summary>
    private static object? DefaultEval(string command)
    {
        try
        {
            var result = CSharpScript.EvaluateAsync(command).GetAwaiter().GetResult();
            return result;
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException($"Evaluation error: {ex.Message}", ex);
        }
    }
}