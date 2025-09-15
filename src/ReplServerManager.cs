using System.Net;
using System.Net.Sockets;
using System.Text;
using Microsoft.CodeAnalysis.CSharp.Scripting;
using Microsoft.CodeAnalysis.Scripting;

namespace WindowsDebugger;

/// <summary>
/// REPL server manager for handling socket connections and evaluation
/// </summary>
internal class ReplServerManager : IDisposable
{
    private readonly InternalOptions _options;
    private TcpListener? _server;

    public ReplServerManager(InternalOptions options)
    {
        _options = options;
    }

    /// <summary>
    /// Starts the TCP server and returns a task with the port number
    /// </summary>
    public Task<int> StartServerAsync()
    {
        _server = new TcpListener(IPAddress.Loopback, 0);
        _server.Start();

        var port = ((IPEndPoint)_server.LocalEndpoint).Port;

        // Start accepting connections asynchronously
        _ = Task.Run(AcceptConnectionsAsync);

        return Task.FromResult(port);
    }

    /// <summary>
    /// Continuously accepts and handles client connections
    /// </summary>
    private async Task AcceptConnectionsAsync()
    {
        while (_server != null)
        {
            try
            {
                var client = await _server.AcceptTcpClientAsync();
                _ = Task.Run(() => HandleClientAsync(client));
            }
            catch (ObjectDisposedException)
            {
                // Server was closed, exit gracefully
                break;
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"Error accepting client connection: {ex.Message}");
            }
        }
    }

    /// <summary>
    /// Handles a client connection with REPL functionality
    /// </summary>
    private async Task HandleClientAsync(TcpClient client)
    {
        using var client_ = client;
        using var stream = client.GetStream();
        using var reader = new StreamReader(stream, Encoding.UTF8);
        using var writer = new StreamWriter(stream, Encoding.UTF8) { AutoFlush = true };

        await writer.WriteLineAsync("C# Windows Debugger REPL");
        await writer.WriteAsync("> ");

        string? line;
        while ((line = await reader.ReadLineAsync()) != null)
        {
            try
            {
                var trimmedCommand = line.Trim();
                object? result;

                if (string.IsNullOrWhiteSpace(trimmedCommand))
                {
                    result = _options.Default;
                }
                else
                {
                    result = _options.Eval(line);
                }

                var output = FormatOutput(result);
                await writer.WriteLineAsync(output);
            }
            catch (Exception ex)
            {
                await writer.WriteLineAsync($"Error: {ex.Message}");
            }

            await writer.WriteAsync("> ");
        }
    }

    /// <summary>
    /// Formats the output for display in the REPL
    /// </summary>
    private static string FormatOutput(object? output)
    {
        if (output == null)
            return "null";

        if (output is string str)
            return str;

        return output.ToString() ?? "null";
    }

    /// <summary>
    /// Closes the server if it's running
    /// </summary>
    public void Dispose()
    {
        _server?.Stop();
        _server = null;
    }
}