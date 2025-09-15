using Xunit;
using WindowsDebugger;

namespace WindowsDebugger.Tests;

public class PowerShellCommandBuilderTests
{
    [Fact]
    public void Constructor_ValidParameters_SetsProperties()
    {
        // Arrange & Act
        var builder = new PowerShellCommandBuilder("Test Title", 1234);
        var command = builder.BuildCommand();

        // Assert
        Assert.NotNull(command);
        Assert.Equal(3, command.Length);
        Assert.Equal("-NoExit", command[0]);
        Assert.Equal("-Command", command[1]);
        Assert.Contains("Test Title", command[2]);
        Assert.Contains("1234", command[2]);
    }

    [Fact]
    public void BuildCommand_WithDefaultTitle_ContainsCorrectStructure()
    {
        // Arrange
        var builder = new PowerShellCommandBuilder("Windows Debugger", 12345);

        // Act
        var command = builder.BuildCommand();

        // Assert
        Assert.Equal("-NoExit", command[0]);
        Assert.Equal("-Command", command[1]);
        Assert.StartsWith("$host.UI.RawUI.WindowTitle='Windows Debugger';", command[2]);
        Assert.Contains("node -e", command[2]);
        Assert.Contains("12345", command[2]);
        Assert.EndsWith("exit", command[2]);
    }

    [Fact]
    public void BuildCommand_WithTitleContainingSingleQuotes_EscapesCorrectly()
    {
        // Arrange
        var titleWithQuotes = "Debug'Session'Test";
        var builder = new PowerShellCommandBuilder(titleWithQuotes, 9999);

        // Act
        var command = builder.BuildCommand();

        // Assert
        Assert.Contains("Debug''Session''Test", command[2]);
    }

    [Fact]
    public void BuildCommand_WithComplexTitle_EscapesOnlySingleQuotes()
    {
        // Arrange
        var complexTitle = "Test'Debug\"Session&<>|";
        var builder = new PowerShellCommandBuilder(complexTitle, 8888);

        // Act
        var command = builder.BuildCommand();

        // Assert
        Assert.Contains("Test''Debug\"Session&<>|", command[2]);
    }

    [Fact]
    public void BuildCommand_WithMultipleSingleQuotes_EscapesAll()
    {
        // Arrange
        var weirdTitle = "A'B'C'D";
        var builder = new PowerShellCommandBuilder(weirdTitle, 7777);

        // Act
        var command = builder.BuildCommand();

        // Assert
        Assert.Contains("A''B''C''D", command[2]);
    }

    [Fact]
    public void BuildCommand_ContainsNodeScript_WithCorrectStructure()
    {
        // Arrange
        var builder = new PowerShellCommandBuilder("Test", 5555);

        // Act
        var command = builder.BuildCommand();

        // Assert
        var commandString = command[2];
        Assert.Contains("const net = require", commandString);
        Assert.Contains("net.connect", commandString);
        Assert.Contains("5555", commandString);
        Assert.Contains("localhost", commandString);
        Assert.Contains("socket.pipe(process.stdout)", commandString);
        Assert.Contains("process.stdin.pipe(socket)", commandString);
    }
}