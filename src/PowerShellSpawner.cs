using System.Diagnostics;

namespace WindowsDebugger;

/// <summary>
/// PowerShell process spawner
/// </summary>
internal static class PowerShellSpawner
{
    /// <summary>
    /// Spawns a PowerShell process with the given command arguments
    /// </summary>
    /// <param name="arguments">PowerShell command arguments</param>
    public static void Spawn(string[] arguments)
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = "powershell.exe",
            Arguments = string.Join(" ", arguments),
            WorkingDirectory = Environment.CurrentDirectory,
            UseShellExecute = true,
            CreateNoWindow = false
        };

        Process.Start(startInfo);
    }
}