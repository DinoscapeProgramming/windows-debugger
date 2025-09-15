using System;
using Xunit;
using WindowsDebugger;

namespace WindowsDebugger.Tests;

public class WindowsDebuggerOptionsTests
{
    [Fact]
    public void DefaultConstructor_SetsNullValues()
    {
        // Arrange & Act
        var options = new WindowsDebuggerOptions();

        // Assert
        Assert.Null(options.Title);
        Assert.Null(options.Default);
        Assert.Null(options.Eval);
    }

    [Fact]
    public void Properties_CanBeSet()
    {
        // Arrange
        var title = "Custom Title";
        var defaultValue = "custom default";
        Func<string, object?> evalFunc = cmd => $"custom eval: {cmd}";

        // Act
        var options = new WindowsDebuggerOptions
        {
            Title = title,
            Default = defaultValue,
            Eval = evalFunc
        };

        // Assert
        Assert.Equal(title, options.Title);
        Assert.Equal(defaultValue, options.Default);
        Assert.Equal(evalFunc, options.Eval);
    }

    [Fact]
    public void InternalOptions_WithDefaults_HasCorrectValues()
    {
        // Arrange & Act
        var options = new InternalOptions
        {
            Title = "Test Title",
            Default = null,
            Eval = _ => null
        };

        // Assert
        Assert.Equal("Test Title", options.Title);
        Assert.Null(options.Default);
        Assert.NotNull(options.Eval);
    }

    [Fact]
    public void InternalOptions_EvalFunction_CanBeInvoked()
    {
        // Arrange
        var testResult = "test result";
        var options = new InternalOptions
        {
            Title = "Test",
            Default = null,
            Eval = _ => testResult
        };

        // Act
        var result = options.Eval("test command");

        // Assert
        Assert.Equal(testResult, result);
    }
}