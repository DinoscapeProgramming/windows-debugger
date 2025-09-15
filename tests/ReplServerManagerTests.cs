using System;
using System.Threading.Tasks;
using Xunit;
using WindowsDebugger;

namespace WindowsDebugger.Tests;

public class ReplServerManagerTests
{
    [Fact]
    public async Task StartServerAsync_ReturnsValidPort()
    {
        // Arrange
        var options = new InternalOptions
        {
            Title = "Test",
            Default = null,
            Eval = _ => "test result"
        };

        using var manager = new ReplServerManager(options);

        // Act
        var port = await manager.StartServerAsync();

        // Assert
        Assert.True(port > 0);
        Assert.True(port <= 65535);
    }

    [Fact]
    public void Dispose_StopsServer()
    {
        // Arrange
        var options = new InternalOptions
        {
            Title = "Test",
            Default = null,
            Eval = _ => "test result"
        };

        var manager = new ReplServerManager(options);

        // Act & Assert - Should not throw
        manager.Dispose();
    }

    [Fact]
    public async Task StartServerAsync_MultipleCalls_ReturnsDifferentPorts()
    {
        // Arrange
        var options = new InternalOptions
        {
            Title = "Test",
            Default = null,
            Eval = _ => "test result"
        };

        using var manager1 = new ReplServerManager(options);
        using var manager2 = new ReplServerManager(options);

        // Act
        var port1 = await manager1.StartServerAsync();
        var port2 = await manager2.StartServerAsync();

        // Assert
        Assert.NotEqual(port1, port2);
    }

    [Fact]
    public void Constructor_ValidOptions_DoesNotThrow()
    {
        // Arrange & Act & Assert
        var options = new InternalOptions
        {
            Title = "Test Title",
            Default = "default value",
            Eval = cmd => $"evaluated: {cmd}"
        };

        var exception = Record.Exception(() => new ReplServerManager(options));
        Assert.Null(exception);
    }
}