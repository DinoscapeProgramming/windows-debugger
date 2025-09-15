import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock modules before importing them
const mockServer = {
  listen: jest.fn(),
  address: jest.fn().mockReturnValue({ port: 12345 }),
  close: jest.fn(),
  on: jest.fn()
};

const mockSocket = {
  pipe: jest.fn(),
  on: jest.fn(), 
  write: jest.fn(),
  end: jest.fn()
};

const mockReplServer = {
  on: jest.fn(),
  close: jest.fn()
};

const mockDomainInstance = {
  run: jest.fn(),
  on: jest.fn()
};

// Mock the modules completely
jest.mock('net', () => ({
  createServer: jest.fn()
}));

jest.mock('repl', () => ({
  start: jest.fn()
}));

jest.mock('domain', () => ({
  create: jest.fn()
}));

jest.mock('child_process', () => ({
  spawn: jest.fn()
}));

// Import after mocking
import windowsDebugger, { WindowsDebuggerOptions } from '../src/index';

describe('Windows Debugger', () => {
  let originalPlatform: string;

  // Get the mocked modules
  const net = require('net');
  const repl = require('repl');
  const domain = require('domain');
  const { spawn } = require('child_process');

  beforeEach(() => {
    jest.clearAllMocks();
    
    originalPlatform = process.platform;
    
    // Reset mock implementations
    mockServer.listen.mockReset();
    mockServer.address.mockReset().mockReturnValue({ port: 12345 });
    mockServer.on.mockReset();
    
    mockDomainInstance.run.mockReset();
    mockDomainInstance.on.mockReset();

    // Setup default behaviors
    mockServer.listen.mockImplementation((_port: any, callback?: any) => {
      if (callback) {
        // Simulate async server start
        setImmediate(() => (callback as () => void)());
      }
      // Return the mock server for chaining
      return mockServer;
    });

    mockDomainInstance.run.mockImplementation((callback: any) => {
      // Always run the callback and return its result, but catch errors
      try {
        const result = callback();
        // If the callback returns a promise, we need to handle it
        if (result && typeof result.then === 'function') {
          // For testing purposes, we'll await the promise but catch any errors
          result.catch((error: Error) => {
            const stackTrace = error.stack || '';
            if (stackTrace.includes('Server creation failed') || 
                stackTrace.includes('This module only works on Windows.')) {
              // These are expected errors in test cases - suppress them
              return;
            }
            // Log unexpected errors but don't rethrow to avoid uncaught promise rejections
            console.error('Unexpected error in domain:', error);
          });
          return result;
        }
        return result;
      } catch (error) {
        // Only suppress errors in error test cases
        const stackTrace = (error as Error).stack || '';
        if (stackTrace.includes('Server creation failed') || 
            stackTrace.includes('This module only works on Windows.')) {
          // These are expected errors in test cases - suppress them
          return;
        }
        // Re-throw unexpected errors
        throw error;
      }
    });

    // Setup module mocks
    net.createServer.mockImplementation((callback?: any) => {
      if (callback) setImmediate(() => callback(mockSocket));
      return mockServer;
    });

    repl.start.mockReturnValue(mockReplServer);
    domain.create.mockReturnValue(mockDomainInstance);
    spawn.mockReturnValue({});
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: true
    });
  });

  describe('Platform Validation', () => {
    test('should throw error on non-Windows platforms', () => {
      Object.defineProperty(process, 'platform', { value: 'linux', writable: true });
      
      // Mock console.error to capture the error
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Mock domain to allow the error to propagate for this test
      mockDomainInstance.run.mockImplementationOnce((callback: any) => {
        try {
          return callback();
        } catch (error) {
          // For this test, we want to see the error thrown
          throw error;
        }
      });
      
      expect(() => windowsDebugger()).toThrow('This module only works on Windows.');
      
      consoleSpy.mockRestore();
    });

    test('should work on Windows platform', () => {
      Object.defineProperty(process, 'platform', { value: 'win32', writable: true });
      
      expect(() => windowsDebugger()).not.toThrow();
    });
  });

  describe('Basic Functionality', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'win32', writable: true });
    });

    test('should create server and spawn PowerShell with default options', async () => {
      windowsDebugger();

      // Wait a bit for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(net.createServer).toHaveBeenCalled();
      expect(domain.create).toHaveBeenCalled();
      expect(mockDomainInstance.run).toHaveBeenCalled();
      expect(mockServer.listen).toHaveBeenCalledWith(0, expect.any(Function));
      expect(spawn).toHaveBeenCalledWith(
        'powershell.exe',
        expect.arrayContaining(['-NoExit', '-Command']),
        expect.objectContaining({
          cwd: process.cwd(),
          shell: true,
          detached: true,
          stdio: 'ignore'
        })
      );
    });

    test('should use custom title in PowerShell command', async () => {
      const customTitle = 'My Custom Debugger';
      windowsDebugger({ title: customTitle });

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10));

      const spawnCalls = spawn.mock.calls;
      expect(spawnCalls).toHaveLength(1);
      const commandString = spawnCalls[0][1][2];
      expect(commandString).toContain(customTitle);
    });

    test('should escape single quotes in title', async () => {
      const titleWithQuotes = "Debug'Session'Test";
      windowsDebugger({ title: titleWithQuotes });

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10));

      const spawnCalls = spawn.mock.calls;
      const commandString = spawnCalls[0][1][2];
      expect(commandString).toContain("Debug''Session''Test");
    });

    test('should start REPL server on socket connection', async () => {
      windowsDebugger();

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(repl.start).toHaveBeenCalledWith(expect.objectContaining({
        input: mockSocket,
        output: mockSocket,
        terminal: false,
        prompt: '> ',
        eval: expect.any(Function),
        writer: expect.any(Function)
      }));
    });
  });

  describe('REPL Evaluation Functions', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'win32', writable: true });
    });

    test('should use custom eval function', async () => {
      const customEval = jest.fn().mockReturnValue('test-result');
      windowsDebugger({ eval: customEval });

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10));

      const replStartCalls = repl.start.mock.calls;
      expect(replStartCalls).toHaveLength(1);
      const replOptions = replStartCalls[0][0];
      const evalFunction = replOptions.eval;
      const mockCallback = jest.fn();

      evalFunction('test-command', {}, 'filename', mockCallback);

      expect(customEval).toHaveBeenCalledWith('test-command');
      expect(mockCallback).toHaveBeenCalledWith(null, 'test-result');
    });

    test('should return default value for empty command', () => {
      const defaultValue = 'default-value';
      windowsDebugger({ default: defaultValue });

      const replStartCalls = repl.start.mock.calls;
      const replOptions = replStartCalls[0][0];
      const evalFunction = replOptions.eval;
      const mockCallback = jest.fn();

      evalFunction('   ', {}, 'filename', mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(null, defaultValue);
    });

    test('should handle eval errors gracefully', () => {
      const errorEval = jest.fn().mockImplementation(() => {
        throw new Error('Evaluation failed');
      });
      windowsDebugger({ eval: errorEval });

      const replStartCalls = repl.start.mock.calls;
      const replOptions = replStartCalls[0][0];
      const evalFunction = replOptions.eval;
      const mockCallback = jest.fn();

      evalFunction('error-command', {}, 'filename', mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(expect.any(Error));
    });

    test('should use built-in eval by default', () => {
      windowsDebugger();

      const replStartCalls = repl.start.mock.calls;
      const replOptions = replStartCalls[0][0];
      const evalFunction = replOptions.eval;
      const mockCallback = jest.fn();

      evalFunction('2 + 2', {}, 'filename', mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(null, 4);
    });

    test('should format output using writer function', () => {
      windowsDebugger();

      const replStartCalls = repl.start.mock.calls;
      const replOptions = replStartCalls[0][0];
      const writerFunction = replOptions.writer;

      const testObject = { key: 'value', nested: { array: [1, 2, 3] } };
      const result = writerFunction(testObject);

      expect(typeof result).toBe('string');
      expect(result).toContain('key');
      expect(result).toContain('value');
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'win32', writable: true });
    });

    test('should handle invalid server address', () => {
      mockServer.address.mockReturnValue(null);
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      windowsDebugger();

      expect(consoleSpy).toHaveBeenCalledWith('Failed to start Windows debugger:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    test('should handle string server address', () => {
      mockServer.address.mockReturnValue('/unix/socket/path');
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      windowsDebugger();

      expect(consoleSpy).toHaveBeenCalledWith('Failed to start Windows debugger:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    test('should handle domain errors silently', () => {
      windowsDebugger();

      const errorCall = mockDomainInstance.on.mock.calls.find(call => call[0] === 'error');
      
      expect(() => {
        if (errorCall && typeof errorCall[1] === 'function') {
          errorCall[1](new Error('Domain error'));
        }
      }).not.toThrow();
    });

    test('should handle server creation failure', () => {
      net.createServer.mockImplementation(() => {
        throw new Error('Server creation failed');
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Mock domain to catch this specific error without rethrowing
      mockDomainInstance.run.mockImplementationOnce((callback: any) => {
        try {
          callback();
        } catch (error) {
          // Domain catches the error silently
          return;
        }
      });

      // This should not throw because domain catches the error
      windowsDebugger();
      
      // The error should be logged
      expect(consoleSpy).toHaveBeenCalledWith('Failed to start Windows debugger:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    test('should handle server listen errors', (done) => {
      const testError = new Error('Listen failed');
      
      mockServer.listen.mockImplementation((_port: any, callback?: any) => {
        if (callback) (callback as () => void)();
        setImmediate(() => {
          const errorCall = mockServer.on.mock.calls.find(call => call[0] === 'error');
          if (errorCall && typeof errorCall[1] === 'function') {
            errorCall[1](testError);
          }
        });
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      windowsDebugger();

      setTimeout(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to start Windows debugger:', testError);
        consoleSpy.mockRestore();
        done();
      }, 100);
    });
  });

  describe('PowerShell Command Building', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'win32', writable: true });
    });

    test('should include correct Node.js script in command', () => {
      windowsDebugger();

      const spawnCalls = spawn.mock.calls;
      const commandString = spawnCalls[0][1][2];
      
      expect(commandString).toContain('const net = require');
      expect(commandString).toContain('net.connect');
      expect(commandString).toContain('12345'); // mock port
      expect(commandString).toContain('localhost');
    });

    test('should handle complex characters in title', () => {
      const complexTitle = "Test'Debug\"Session&<>|";
      windowsDebugger({ title: complexTitle });

      const spawnCalls = spawn.mock.calls;
      const commandString = spawnCalls[0][1][2];
      
      // Single quotes should be escaped as double single quotes
      expect(commandString).toContain("Test''Debug");
    });

    test('should handle multiple single quotes', () => {
      const weirdTitle = "A'B'C'D";
      windowsDebugger({ title: weirdTitle });

      const spawnCalls = spawn.mock.calls;
      const commandString = spawnCalls[0][1][2];
      expect(commandString).toContain("A''B''C''D");
    });
  });

  describe('Options Handling', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'win32', writable: true });
    });

    test('should accept empty options object', () => {
      expect(() => windowsDebugger({})).not.toThrow();
    });

    test('should accept undefined options', () => {
      expect(() => windowsDebugger()).not.toThrow();
    });

    test('should apply all custom options correctly', () => {
      const customEval = jest.fn().mockReturnValue('custom-eval-result');
      const options: WindowsDebuggerOptions = {
        title: 'Custom Title',
        default: 'custom-default',
        eval: customEval
      };

      windowsDebugger(options);

      // Check title was used
      const spawnCalls = spawn.mock.calls;
      expect(spawnCalls[0][1][2]).toContain('Custom Title');

      // Check eval and default were configured
      const replStartCalls = repl.start.mock.calls;
      const replOptions = replStartCalls[0][0];
      const mockCallback = jest.fn();

      // Test custom eval
      replOptions.eval('test', {}, 'file', mockCallback);
      expect(customEval).toHaveBeenCalledWith('test');

      // Test default value for empty command  
      mockCallback.mockClear();
      replOptions.eval('  ', {}, 'file', mockCallback);
      expect(mockCallback).toHaveBeenCalledWith(null, 'custom-default');
    });
  });

  describe('Module Exports', () => {
    test('should export default function', () => {
      expect(typeof windowsDebugger).toBe('function');
    });

    test('should have CommonJS compatibility', () => {
      const commonJsExports = require('../src/index');
      expect(typeof commonJsExports).toBe('function');
      expect(typeof commonJsExports.default).toBe('function');
      expect(commonJsExports).toBe(commonJsExports.default);
    });
  });

  describe('Integration and Edge Cases', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'win32', writable: true });
    });

    test('should complete full initialization flow', () => {
      windowsDebugger({ title: 'Integration Test' });

      // Verify complete flow
      expect(domain.create).toHaveBeenCalled();
      expect(mockDomainInstance.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockDomainInstance.run).toHaveBeenCalled();
      expect(net.createServer).toHaveBeenCalled();
      expect(mockServer.listen).toHaveBeenCalledWith(0, expect.any(Function));
      expect(mockServer.address).toHaveBeenCalled();
      expect(spawn).toHaveBeenCalled();
      expect(repl.start).toHaveBeenCalled();
    });

    test('should handle default configuration paths', () => {
      windowsDebugger({});

      const spawnCalls = spawn.mock.calls;
      expect(spawnCalls[0][1][2]).toContain('Windows Debugger'); // default title

      const replStartCalls = repl.start.mock.calls;
      const replOptions = replStartCalls[0][0];
      const mockCallback = jest.fn();

      // Test default eval (should use built-in eval)
      replOptions.eval('1 + 1', {}, 'file', mockCallback);
      expect(mockCallback).toHaveBeenCalledWith(null, 2);

      // Test default value (undefined)
      mockCallback.mockClear();
      replOptions.eval('', {}, 'file', mockCallback);
      expect(mockCallback).toHaveBeenCalledWith(null, undefined);
    });

    test('should handle port number in Node.js script', () => {
      // Test with different port number
      mockServer.address.mockReturnValue({ port: 9999 });
      windowsDebugger();

      const spawnCalls = spawn.mock.calls;
      const commandString = spawnCalls[0][1][2];
      expect(commandString).toContain('9999');
    });

    test('should work with minimal valid configuration', () => {
      windowsDebugger({ title: 'Min' });

      expect(spawn).toHaveBeenCalledWith(
        'powershell.exe',
        expect.any(Array),
        expect.objectContaining({
          cwd: expect.any(String),
          shell: true,
          detached: true,
          stdio: 'ignore'
        })
      );
    });
  });

  describe('TypeScript Interface Validation', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'win32', writable: true });
    });

    test('should accept valid WindowsDebuggerOptions interface', () => {
      const validOptions: WindowsDebuggerOptions = {
        title: 'Test Title',
        default: 'test-default',
        eval: (cmd: string) => `evaluated: ${cmd}`
      };

      expect(() => windowsDebugger(validOptions)).not.toThrow();
    });

    test('should accept partial WindowsDebuggerOptions interface', () => {
      const partialOptions: WindowsDebuggerOptions = {
        title: 'Partial Test'
      };

      expect(() => windowsDebugger(partialOptions)).not.toThrow();
    });
  });
});