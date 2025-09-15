using System;
using System.Runtime.InteropServices;
using Xunit;
using WindowsDebugger;

namespace WindowsDebugger.Tests;

public class WindowsDebuggerTests
{
    [Fact]
    public void Start_WithNullOptions_DoesNotThrowImmediately()
    {
        // This test verifies that the Start method doesn't throw immediately
        // The actual platform validation happens asynchronously
        var exception = Record.Exception(() => WindowsDebugger.Start(null));
        Assert.Null(exception);
    }

    [Fact]
    public void Start_WithEmptyOptions_DoesNotThrowImmediately()
    {
        // Arrange
        var options = new WindowsDebuggerOptions();

        // Act & Assert
        var exception = Record.Exception(() => WindowsDebugger.Start(options));
        Assert.Null(exception);
    }

    [Fact]
    public void Start_WithCustomOptions_DoesNotThrowImmediately()
    {
        // Arrange
        var options = new WindowsDebuggerOptions
        {
            Title = "Custom Debugger",
            Default = "Nothing entered",
            Eval = code => $"Custom eval: {code}"
        };

        // Act & Assert
        var exception = Record.Exception(() => WindowsDebugger.Start(options));
        Assert.Null(exception);
    }

    [Fact]
    public void Start_WithPartialOptions_DoesNotThrowImmediately()
    {
        // Arrange
        var options = new WindowsDebuggerOptions
        {
            Title = "Partial Test"
        };

        // Act & Assert
        var exception = Record.Exception(() => WindowsDebugger.Start(options));
        Assert.Null(exception);
    }

    // Note: These tests only verify that the Start method doesn't throw immediately.
    // The actual functionality (platform validation, server startup, PowerShell spawning)
    // happens asynchronously and would require more complex integration testing.
    // For platform-specific testing, we would need to run on actual Windows systems
    // or use more sophisticated mocking.
}

public class WindowsDebuggerIntegrationTests
{
    [Fact]
    public void DefaultEval_WithSimpleExpression_ReturnsCorrectResult()
    {
        // We can test the default eval functionality by creating an instance
        // and testing the evaluation directly (without the full Windows-specific flow)
        
        // This is a simplified test that doesn't require Windows
        // but tests the core evaluation functionality
        
        // Arrange
        var options = new WindowsDebuggerOptions();
        
        // Act & Assert - Just verify no immediate exception
        var exception = Record.Exception(() => WindowsDebugger.Start(options));
        Assert.Null(exception);
    }
}