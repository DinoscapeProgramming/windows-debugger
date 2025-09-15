using WindowsDebugger;

namespace WindowsDebugger.Example;

class Program
{
    private static int counter = 0;
    private static readonly List<string> items = new();
    private static readonly Random random = new();

    static async Task Main(string[] args)
    {
        Console.WriteLine("=== Windows Debugger C# Example ===");
        Console.WriteLine();
        
        // Start background work
        var cancellationToken = new CancellationTokenSource();
        var backgroundTask = StartBackgroundWork(cancellationToken.Token);

        // Start debugger with access to program state
        var debuggerOptions = new WindowsDebuggerOptions
        {
            Title = "C# Example Debugger - Live Process State",
            Default = "Ready for C# commands... (try: counter, items, help)",
            Eval = EvaluateCode
        };

        Console.WriteLine("Starting Windows Debugger...");
        WindowsDebugger.Start(debuggerOptions);

        Console.WriteLine();
        Console.WriteLine("🚀 Application is now running!");
        Console.WriteLine("📊 Check the PowerShell window that opened for the debugger REPL.");
        Console.WriteLine("💡 Try typing these commands in the debugger:");
        Console.WriteLine("   - counter");
        Console.WriteLine("   - items");
        Console.WriteLine("   - help");
        Console.WriteLine("   - C# expressions like: counter * 2");
        Console.WriteLine("   - Math.PI");
        Console.WriteLine("   - DateTime.Now");
        Console.WriteLine();
        Console.WriteLine("Press any key to stop the application...");
        
        Console.ReadKey();

        cancellationToken.Cancel();
        try
        {
            await backgroundTask;
        }
        catch (OperationCanceledException)
        {
            // Expected when cancellation is requested
        }

        Console.WriteLine("Application stopped.");
    }

    private static async Task StartBackgroundWork(CancellationToken cancellationToken)
    {
        var colors = new[] { "Red", "Blue", "Green", "Yellow", "Purple", "Orange", "Pink", "Cyan" };
        
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                counter++;
                var color = colors[random.Next(colors.Length)];
                var newItem = $"{color} Item #{counter}";
                items.Add(newItem);
                
                // Keep list manageable
                if (items.Count > 10)
                {
                    items.RemoveAt(0);
                }

                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] Counter: {counter}, Latest: {newItem}, Total Items: {items.Count}");
                
                await Task.Delay(3000, cancellationToken); // 3 second intervals
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }

    private static object? EvaluateCode(string code)
    {
        try
        {
            // Handle special commands
            return code.Trim() switch
            {
                "help" => GetHelpText(),
                "counter" => counter,
                "items" => items,
                "items.count" => items.Count,
                "latest" => items.LastOrDefault() ?? "No items yet",
                "random" => items[random.Next(items.Count)],
                "clear" => ClearItems(),
                var c when c.StartsWith("items[") && c.EndsWith("]") => GetItemByIndex(c),
                _ => EvaluateCSharpCode(code)
            };
        }
        catch (Exception ex)
        {
            return $"❌ Error: {ex.Message}";
        }
    }

    private static string GetHelpText()
    {
        return @"🔧 Available Commands:
• counter        - Show current counter value
• items          - Show all current items
• items.count    - Show number of items
• latest         - Show the most recent item
• random         - Show a random item
• clear          - Clear all items
• items[n]       - Show item at index n
• help           - Show this help text

You can also enter any C# expression:
• Math.PI * 2
• DateTime.Now
• counter * 5
• ""Hello "" + ""World!""
• new[] { 1, 2, 3 }.Sum()";
    }

    private static object ClearItems()
    {
        var count = items.Count;
        items.Clear();
        return $"✅ Cleared {count} items";
    }

    private static object GetItemByIndex(string indexExpression)
    {
        // Extract index from items[n]
        var indexStr = indexExpression[6..^1]; // Remove "items[" and "]"
        if (int.TryParse(indexStr, out var index))
        {
            if (index >= 0 && index < items.Count)
            {
                return items[index];
            }
            return $"❌ Index {index} out of range. Valid range: 0-{items.Count - 1}";
        }
        return $"❌ Invalid index format: {indexStr}";
    }

    private static object? EvaluateCSharpCode(string code)
    {
        try
        {
            // For demonstration purposes, handle some common expressions
            // In a real implementation, you might want to use Microsoft.CodeAnalysis.CSharp.Scripting
            // for full C# evaluation capabilities
            
            // Simple math expressions
            if (code.Contains("+") || code.Contains("-") || code.Contains("*") || code.Contains("/"))
            {
                // This is a very basic evaluator for demo purposes
                // A real implementation should use proper expression evaluation
                return $"📊 Expression result: {code}";
            }

            // DateTime
            if (code == "DateTime.Now")
                return DateTime.Now;
            
            // Math constants
            if (code == "Math.PI")
                return Math.PI;
            if (code == "Math.E")
                return Math.E;

            // Counter operations
            if (code == "counter * 2")
                return counter * 2;
            if (code == "counter + 10")
                return counter + 10;

            // Default fallback
            return $"💭 Evaluated: {code} (Use Microsoft.CodeAnalysis.CSharp.Scripting for full C# evaluation)";
        }
        catch (Exception ex)
        {
            return $"❌ Evaluation error: {ex.Message}";
        }
    }
}