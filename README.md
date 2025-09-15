# Windows Debugger

A lightweight Node.js REPL debugger for **Windows** that spawns a PowerShell window and connects to your running process for live debugging.

**✨ Now with TypeScript support!** This module has been fully migrated to TypeScript for better type safety and developer experience.

## ✨ Features

- Windows-only debugger (uses PowerShell)
- Creates a **separate REPL session** connected to your Node.js process
- Lets you **inspect variables, run commands, and evaluate code** in real-time
- Provides a configurable **default return value** when no command is entered
- Automatically sets a **custom PowerShell window title** for your session
- **TypeScript support** with full type definitions
- **DRY code architecture** with modular, reusable components

---

## 📦 Installation

```bash
npm install windows-debugger
```

---

## 🚀 Usage

### JavaScript
```js
const windowsDebugger = require("windows-debugger");

// Start a debugger session
windowsDebugger({
  title: "MyApp Debugger",
  default: "Nothing entered",
  eval: (code) => eval(code)
});
```

### TypeScript
```typescript
import windowsDebugger, { WindowsDebuggerOptions } from "windows-debugger";

const options: WindowsDebuggerOptions = {
  title: "MyApp Debugger",
  default: "Nothing entered",
  eval: (code: string) => eval(code)
};

windowsDebugger(options);
```

When called, this will:

1. Start a local TCP REPL server.
2. Launch a new PowerShell window with the given title.
3. Connect the REPL to your running Node.js process.

---

## 🛠 Example

```js
const windowsDebugger = require("windows-debugger");

let counter = 0;

setInterval(() => {
  counter++;
  console.log("Counter:", counter);
}, 2000);

windowsDebugger({
  title: "Counter Debugger",
  default: "No input",
  eval: (code) => eval(code)
});
```

* A new **PowerShell window** will open with the title `Counter Debugger`.
* Inside the window, you can type:

  ```js
  counter
  ```

  And see the live value of the `counter` variable.

---

## ⚠️ Requirements

* **Windows only** (`process.platform === "win32"` is enforced)
* Requires **PowerShell** installed and accessible via `powershell.exe`
* Works with **Node.js v14+** (earlier versions untested)

---

## 📖 API

### `windowsDebugger(options?)`

| Option    | Type       | Default          | Description                                                            |
| --------- | ---------- | ---------------- | ---------------------------------------------------------------------- |
| `title`   | `string`   | `"Windows Debugger"` | The window title for the PowerShell debugger session.            |
| `default` | `any`      | `undefined`      | The default return value when pressing enter without typing a command. |
| `eval`    | `Function` | `eval`           | An `eval` function used to evaluate REPL input.                       |

### TypeScript Interface

```typescript
interface WindowsDebuggerOptions {
  /** The window title for the PowerShell debugger session */
  title?: string;
  /** The default return value when pressing enter without typing a command */
  default?: any;
  /** An eval function used to evaluate REPL input */
  eval?: (command: string) => any;
}
```

---

## 🏗️ Architecture & Development

### TypeScript Migration

This module has been completely rewritten in TypeScript with the following improvements:

- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **DRY Principles**: Modular architecture with reusable components:
  - `PowerShellCommandBuilder`: Handles PowerShell command construction and escaping
  - `ReplServerManager`: Manages REPL server lifecycle and socket connections
  - `PlatformValidator`: Validates Windows platform requirement
  - `PowerShellSpawner`: Handles PowerShell process spawning
- **Better Error Handling**: Centralized error management with proper async/await patterns
- **Improved Maintainability**: Clear separation of concerns and single responsibility classes

### Build Process

```bash
# Build the TypeScript code
npm run build

# The compiled JavaScript will be in dist/
# Type definitions will be available as dist/index.d.ts
```

### Source Structure

```
src/
└── index.ts          # Main TypeScript source
dist/
├── index.js          # Compiled JavaScript
├── index.js.map      # Source map
├── index.d.ts        # Type definitions
└── index.d.ts.map    # Type definition source map
```

---

## 🔒 Error Handling

* All REPL errors are caught and displayed in the PowerShell session.
* Domain errors are suppressed to avoid crashing the main process.

---

## 📝 License

MIT