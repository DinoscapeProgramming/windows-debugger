using System;
using System.Runtime.InteropServices;
using Xunit;
using WindowsDebugger;

namespace WindowsDebugger.Tests;

public class PlatformValidatorTests
{
    [Fact]
    public void ValidateWindows_WhenOnWindows_DoesNotThrow()
    {
        // This test will only pass on Windows
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            var exception = Record.Exception(() => PlatformValidator.ValidateWindows());
            Assert.Null(exception);
        }
    }

    [Fact]
    public void ValidateWindows_WhenNotOnWindows_ThrowsInvalidOperationException()
    {
        // This test will only pass on non-Windows systems
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            var exception = Assert.Throws<InvalidOperationException>(() => PlatformValidator.ValidateWindows());
            Assert.Equal("This module only works on Windows.", exception.Message);
        }
    }
}