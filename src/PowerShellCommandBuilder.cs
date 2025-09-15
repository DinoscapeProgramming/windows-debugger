namespace WindowsDebugger;

/// <summary>
/// PowerShell command builder for creating the debugger session
/// </summary>
internal class PowerShellCommandBuilder
{
    private readonly string _title;
    private readonly int _port;

    public PowerShellCommandBuilder(string title, int port)
    {
        _title = title;
        _port = port;
    }

    /// <summary>
    /// Escapes single quotes in PowerShell strings by doubling them
    /// </summary>
    private static string EscapePowerShellString(string str)
    {
        return str.Replace("'", "''");
    }

    /// <summary>
    /// Builds the Node.js command that will run inside PowerShell
    /// Note: This maintains compatibility with the original Node.js implementation
    /// by using the same Node.js TCP client approach
    /// </summary>
    private string BuildNodeCommand()
    {
        var nodeScript = @$"
      const net = require('net');
      const socket = net.connect({_port}, 'localhost');
      socket.pipe(process.stdout);
      process.stdin.pipe(socket);
    ".Replace("\n", " ").Replace("'", "''");

        return $"node -e '{nodeScript}'";
    }

    /// <summary>
    /// Builds the complete PowerShell command array
    /// </summary>
    public string[] BuildCommand()
    {
        var escapedTitle = EscapePowerShellString(_title);
        var nodeCommand = BuildNodeCommand();

        return new string[]
        {
            "-NoExit",
            "-Command",
            $"$host.UI.RawUI.WindowTitle='{escapedTitle}'; {nodeCommand}; exit"
        };
    }
}