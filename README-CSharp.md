# Windows Debugger - C# Edition

A lightweight .NET library that spawns a PowerShell window and connects to your running process for live debugging with C# REPL capabilities.

**✨ Now rewritten in C#!** This library has been completely rewritten from TypeScript/Node.js to C# for better integration with .NET applications.

## ✨ Features

- **Windows-only** debugger (validates OS platform)
- Creates a **separate REPL session** connected to your .NET process
- Lets you **inspect variables, run C# expressions, and evaluate code** in real-time
- Provides a configurable **default return value** when no command is entered
- Automatically sets a **custom PowerShell window title** for your session
- **Full C# script evaluation** using Microsoft.CodeAnalysis.CSharp.Scripting
- **Async/await support** for non-blocking operations

---

## 📦 Installation

### NuGet Package Manager
```powershell
Install-Package WindowsDebugger
```

### .NET CLI
```bash
dotnet add package WindowsDebugger
```

### PackageReference
```xml
<PackageReference Include="WindowsDebugger" Version="1.0.9" />
```

---

## 🚀 Usage

### Basic Usage
```csharp
using WindowsDebugger;

// Start with default options
WindowsDebugger.Start();
```

### Advanced Configuration
```csharp
using WindowsDebugger;

// Custom configuration
var options = new WindowsDebuggerOptions
{
    Title = "MyApp Debugger",
    Default = "No command entered",
    Eval = code => 
    {
        // Custom evaluation logic
        return $"Custom eval result: {code}";
    }
};

WindowsDebugger.Start(options);
```

### Real-world Example
```csharp
using WindowsDebugger;

class Program
{
    private static int counter = 0;
    private static readonly List<string> items = new();

    static async Task Main(string[] args)
    {
        // Start background work
        var cancellationToken = new CancellationTokenSource();
        var backgroundTask = StartBackgroundWork(cancellationToken.Token);

        // Start debugger with access to program state
        var debuggerOptions = new WindowsDebuggerOptions
        {
            Title = "MyApp Live Debugger",
            Default = "Ready for C# commands...",
            Eval = EvaluateCode
        };

        WindowsDebugger.Start(debuggerOptions);

        Console.WriteLine("Application running. Check PowerShell window for debugger.");
        Console.WriteLine("Press any key to exit...");
        Console.ReadKey();

        cancellationToken.Cancel();
        await backgroundTask;
    }

    private static async Task StartBackgroundWork(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            counter++;
            items.Add($"Item {counter}");
            Console.WriteLine($"Counter: {counter}, Items: {items.Count}");
            
            await Task.Delay(2000, cancellationToken);
        }
    }

    private static object? EvaluateCode(string code)
    {
        // Make program variables available in the REPL context
        var globals = new
        {
            counter = counter,
            items = items,
            itemCount = items.Count,
            lastItem = items.LastOrDefault()
        };

        try
        {
            // This would need more sophisticated implementation in real usage
            // For demo purposes, we'll handle some basic cases
            return code switch
            {
                "counter" => counter,
                "items" => items,
                "items.Count" => items.Count,
                var c when c.StartsWith("items[") && c.EndsWith("]") => 
                    int.TryParse(c[6..^1], out var index) && index >= 0 && index < items.Count 
                        ? items[index] : "Index out of range",
                _ => $"Executed: {code}"
            };
        }
        catch (Exception ex)
        {
            return $"Error: {ex.Message}";
        }
    }
}
```

When you run this, you can:
1. Open the PowerShell debugger window that appears
2. Type commands like:
   - `counter` - See the current counter value
   - `items` - View the current items list
   - `items.Count` - Get the number of items
   - `items[0]` - Access specific items

---

## ⚠️ Requirements

* **Windows only** (validates `RuntimeInformation.IsOSPlatform(OSPlatform.Windows)`)
* Requires **PowerShell** installed and accessible via `powershell.exe`
* Requires **Node.js** for the PowerShell-to-.NET bridge (maintains compatibility)
* Works with **.NET 8.0+**

---

## 📖 API Reference

### `WindowsDebugger.Start(options?)`

Starts the Windows debugger with the specified options.

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `options` | `WindowsDebuggerOptions?` | Optional configuration (null uses defaults) |

#### WindowsDebuggerOptions Properties

| Property  | Type | Default | Description |
|-----------|------|---------|-------------|
| `Title`   | `string?` | `"Windows Debugger"` | PowerShell window title |
| `Default` | `object?` | `null` | Default return value for empty commands |
| `Eval`    | `Func<string, object?>?` | C# script evaluation | Custom evaluation function |

### Example API Usage

```csharp
// Minimal usage
WindowsDebugger.Start();

// Custom title only
WindowsDebugger.Start(new WindowsDebuggerOptions 
{ 
    Title = "My Custom Debugger" 
});

// Full customization
WindowsDebugger.Start(new WindowsDebuggerOptions
{
    Title = "Advanced Debugger",
    Default = "Awaiting command...",
    Eval = code => 
    {
        // Your custom evaluation logic
        if (code == "help")
            return "Available commands: help, status, quit";
            
        return Microsoft.CodeAnalysis.CSharp.Scripting.CSharpScript
            .EvaluateAsync(code).Result;
    }
});
```

---

## 🏗️ Architecture

### Migration from TypeScript/Node.js

This C# version maintains API compatibility with the original TypeScript implementation while leveraging .NET capabilities:

#### Core Components

- **`WindowsDebugger`**: Main static entry point class
- **`WindowsDebuggerOptions`**: Configuration class with the same interface as TypeScript version
- **`PlatformValidator`**: Validates Windows OS requirement  
- **`PowerShellCommandBuilder`**: Constructs PowerShell commands with proper escaping
- **`ReplServerManager`**: Manages TCP server and client connections
- **`PowerShellSpawner`**: Handles PowerShell process creation

#### Key Improvements

- **Native .NET Integration**: Direct access to .NET runtime and libraries
- **C# Script Evaluation**: Uses Microsoft.CodeAnalysis.CSharp.Scripting for powerful REPL
- **Async/Await**: Full async support throughout the pipeline
- **Strong Typing**: Complete type safety with nullable reference types
- **Memory Management**: Proper disposal patterns with IDisposable

#### Compatibility Bridge

The implementation maintains compatibility with the Node.js bridge approach:
- PowerShell still uses Node.js to connect to the .NET TCP server
- This ensures the same user experience while running on .NET runtime
- Future versions may implement a pure .NET PowerShell module

---

## 🔒 Error Handling

- **Platform Validation**: Throws `InvalidOperationException` on non-Windows systems
- **TCP Server Errors**: Gracefully handles port binding and connection issues
- **Script Evaluation**: Catches and reports C# compilation/runtime errors
- **Process Management**: Handles PowerShell process startup failures

---

## 🧪 Testing

The library includes comprehensive unit tests covering:

- Platform validation logic
- PowerShell command building and escaping
- TCP server management
- Configuration option handling
- Error scenarios and edge cases

Run tests with:
```bash
dotnet test
```

---

## 🚀 Migration Guide

### From TypeScript/Node.js Version

The C# version maintains the same API surface:

```typescript
// TypeScript (old)
import windowsDebugger from 'windows-debugger';

windowsDebugger({
  title: "My Debugger",
  default: "No input",
  eval: (code) => eval(code)
});
```

```csharp
// C# (new)
using WindowsDebugger;

WindowsDebugger.Start(new WindowsDebuggerOptions
{
    Title = "My Debugger",
    Default = "No input",
    Eval = code => /* evaluation logic */
});
```

#### Key Differences

1. **Static Method**: Use `WindowsDebugger.Start()` instead of importing a function
2. **Configuration Object**: Use `WindowsDebuggerOptions` class instead of JavaScript object
3. **Evaluation**: Provide `Func<string, object?>` instead of JavaScript function
4. **Async Nature**: The Start method is fire-and-forget (runs asynchronously)

---

## 📝 License

MIT License - Same as the original TypeScript implementation.