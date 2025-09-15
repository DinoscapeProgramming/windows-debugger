# Windows Debugger Repository Structure

## 📁 Dual Implementation Repository

This repository now contains **BOTH** the original TypeScript/Node.js version and the new C# version:

```
windows-debugger/
├── 📁 TypeScript/Node.js Version (Original)
│   ├── src/index.ts              # Main TypeScript source
│   ├── tests/windowsDebugger.test.ts # Jest tests (29/30 passing)
│   ├── package.json              # Node.js package config
│   ├── tsconfig.json             # TypeScript config
│   ├── index.js                  # Compiled JS entry point
│   └── dist/                     # Compiled output
│
├── 📁 C# Version (New Rewrite)
│   ├── WindowsDebugger.sln       # Visual Studio solution
│   ├── src/                      # C# source code
│   │   ├── WindowsDebugger.csproj # Main project file
│   │   ├── WindowsDebugger.cs    # Main entry point
│   │   ├── WindowsDebuggerOptions.cs # Configuration
│   │   ├── PowerShellCommandBuilder.cs
│   │   ├── ReplServerManager.cs
│   │   ├── PlatformValidator.cs
│   │   └── PowerShellSpawner.cs
│   ├── tests/                    # xUnit tests
│   │   ├── WindowsDebugger.Tests.csproj
│   │   ├── WindowsDebuggerTests.cs
│   │   ├── PowerShellCommandBuilderTests.cs
│   │   └── [other test files]    # 21/21 tests passing
│   └── examples/                 # Example application
│       ├── WindowsDebugger.Example.csproj
│       └── Program.cs            # Working console app demo
│
├── 📄 Documentation
│   ├── README.md                 # Original + dual version overview
│   ├── README-CSharp.md          # C# version documentation
│   └── LICENSE                   # MIT License
│
└── 📄 Configuration
    ├── .gitignore               # Excludes build artifacts
    └── jest.config.js           # Jest testing config
```

## ✅ Status Summary

| Version | Language | Tests | Build | Status |
|---------|----------|-------|--------|--------|
| **Original** | TypeScript/Node.js | 29/30 ✅ | ✅ | Working |
| **New Rewrite** | C#/.NET 8.0 | 21/21 ✅ | ✅ | Complete |

## 🚀 Quick Start

### TypeScript/Node.js (Original)
```bash
npm install
npm run build
npm test
```

### C#/.NET (New)
```bash
dotnet build
dotnet test
dotnet run --project examples
```

Both implementations provide identical functionality for Windows debugging with PowerShell REPL integration.