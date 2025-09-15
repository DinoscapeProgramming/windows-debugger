using System.Runtime.InteropServices;

namespace WindowsDebugger;

/// <summary>
/// Windows platform validator
/// </summary>
internal static class PlatformValidator
{
    /// <summary>
    /// Validates that the current platform is Windows
    /// </summary>
    /// <exception cref="InvalidOperationException">Thrown when not running on Windows</exception>
    public static void ValidateWindows()
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            throw new InvalidOperationException("This module only works on Windows.");
        }
    }
}