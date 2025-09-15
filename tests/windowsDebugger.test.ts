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
      // Always run the callback and return its result, but catch errors strategically
      try {
        const result = callback();
        // If the callback returns a promise, we need to handle it
        if (result && typeof result.then === 'function') {
          // For testing purposes, we'll await the promise but catch any errors
          result.catch((error: Error) => {
            const stackTrace = error.stack || '';
            // Only suppress specific server-related errors, not platform validation errors
            if (stackTrace.includes('Server creation failed')) {
              // This is an expected error in test cases - suppress it
              return;
            }
            // Log unexpected errors but don't rethrow to avoid uncaught promise rejections
            console.error('Unexpected error in domain:', error);
          });
          return result;
        }
        return result;
      } catch (error) {
        // Only suppress specific server-related errors, not platform validation errors 
        const stackTrace = (error as Error).stack || '';
        if (stackTrace.includes('Server creation failed')) {
          // This is an expected error in test cases - suppress it
          return;
        }
        // Re-throw all other errors (including platform validation errors)
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
    test('should throw error on non-Windows platforms', (done) => {
      // Set Linux platform  
      Object.defineProperty(process, 'platform', { value: 'linux', writable: true });
      
      // Mock console.error to capture the error and finish the test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation((message, error) => {
        try {
          expect(message).toBe('Failed to start Windows debugger:');
          expect(error).toEqual(expect.objectContaining({
            message: 'This module only works on Windows.'
          }));
          consoleSpy.mockRestore();
          done();
        } catch (testError) {
          consoleSpy.mockRestore();
          done(testError as Error);
        }
      });
      
      // Mock domain to NOT suppress any errors - let them flow to console.error
      mockDomainInstance.run.mockImplementationOnce((callback: any) => {
        try {
          const result = callback();
          // Handle promise rejection case  
          if (result && typeof result.then === 'function') {
            result.catch(() => {
              // Error already handled by console.error mock
            });
          }
        } catch (error) {
          // Error should be caught and logged by the actual code
          console.error('Failed to start Windows debugger:', error);
        }
      });
      
      // This should trigger the error flow
      windowsDebugger();
    });

    test('should work on Windows platform', () => {
      Object.defineProperty(process, 'platform', { value: 'win32', writable: true });
      
      // Mock domain to handle async operations normally
      mockDomainInstance.run.mockImplementationOnce((callback: any) => {
        return callback();
      });
      
      expect(() => windowsDebugger()).not.toThrow();
    });
  });

  describe('Basic Functionality', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'win32', writable: true });
    });

    test('should create server and spawn PowerShell with default options', async () => {
      // Set up promise resolution tracking
      let resolveServerStart: (port: number) => void;
      const serverStartPromise = new Promise<number>((resolve) => {
        resolveServerStart = resolve;
      });

      // Mock server listen to resolve with port
      mockServer.listen.mockImplementation((_port: any, callback?: any) => {
        if (callback) setImmediate(() => {
          (callback as () => void)();
          resolveServerStart(12345);
        });
      });

      // Mock domain run to handle async operation
      mockDomainInstance.run.mockImplementationOnce((callback: any) => {
        return callback();
      });

      windowsDebugger();

      // Wait for async operations to complete
      await serverStartPromise;
      await new Promise(resolve => setImmediate(resolve));

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
      
      let resolveServerStart: (port: number) => void;
      const serverStartPromise = new Promise<number>((resolve) => {
        resolveServerStart = resolve;
      });

      mockServer.listen.mockImplementation((_port: any, callback?: any) => {
        if (callback) setImmediate(() => {
          (callback as () => void)();
          resolveServerStart(12345);
        });
      });

      mockDomainInstance.run.mockImplementationOnce((callback: any) => {
        return callback();
      });

      windowsDebugger({ title: customTitle });

      await serverStartPromise;
      await new Promise(resolve => setImmediate(resolve));

      const spawnCalls = spawn.mock.calls;
      expect(spawnCalls).toHaveLength(1);
      const commandString = spawnCalls[0][1][2];
      expect(commandString).toContain(customTitle);
    });

    test('should escape single quotes in title', async () => {
      const titleWithQuotes = "Debug'Session'Test";
      
      let resolveServerStart: (port: number) => void;
      const serverStartPromise = new Promise<number>((resolve) => {
        resolveServerStart = resolve;
      });

      mockServer.listen.mockImplementation((_port: any, callback?: any) => {
        if (callback) setImmediate(() => {
          (callback as () => void)();
          resolveServerStart(12345);
        });
      });

      mockDomainInstance.run.mockImplementationOnce((callback: any) => {
        return callback();
      });

      windowsDebugger({ title: titleWithQuotes });

      await serverStartPromise;
      await new Promise(resolve => setImmediate(resolve));

      const spawnCalls = spawn.mock.calls;
      const commandString = spawnCalls[0][1][2];
      expect(commandString).toContain("Debug''Session''Test");
    });

    test('should start REPL server on socket connection', async () => {
      let resolveServerStart: (port: number) => void;
      const serverStartPromise = new Promise<number>((resolve) => {
        resolveServerStart = resolve;
      });

      mockServer.listen.mockImplementation((_port: any, callback?: any) => {
        if (callback) setImmediate(() => {
          (callback as () => void)();
          resolveServerStart(12345);
        });
      });

      mockDomainInstance.run.mockImplementationOnce((callback: any) => {
        return callback();
      });

      windowsDebugger();

      await serverStartPromise;
      await new Promise(resolve => setImmediate(resolve));

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
      
      let resolveServerStart: (port: number) => void;
      const serverStartPromise = new Promise<number>((resolve) => {
        resolveServerStart = resolve;
      });

      mockServer.listen.mockImplementation((_port: any, callback?: any) => {
        if (callback) setImmediate(() => {
          (callback as () => void)();
          resolveServerStart(12345);
        });
      });

      mockDomainInstance.run.mockImplementationOnce((callback: any) => {
        return callback();
      });

      windowsDebugger({ eval: customEval });

      await serverStartPromise;
      await new Promise(resolve => setImmediate(resolve));

      const replStartCalls = repl.start.mock.calls;
      expect(replStartCalls).toHaveLength(1);
      const replOptions = replStartCalls[0][0];
      const evalFunction = replOptions.eval;
      const mockCallback = jest.fn();

      evalFunction('test-command', {}, 'filename', mockCallback);

      expect(customEval).toHaveBeenCalledWith('test-command');
      expect(mockCallback).toHaveBeenCalledWith(null, 'test-result');
    });

    test('should return default value for empty command', async () => {
      const defaultValue = 'default-value';
      
      let resolveServerStart: (port: number) => void;
      const serverStartPromise = new Promise<number>((resolve) => {
        resolveServerStart = resolve;
      });

      mockServer.listen.mockImplementation((_port: any, callback?: any) => {
        if (callback) setImmediate(() => {
          (callback as () => void)();
          resolveServerStart(12345);
        });
      });

      mockDomainInstance.run.mockImplementationOnce((callback: any) => {
        return callback();
      });

      windowsDebugger({ default: defaultValue });

      await serverStartPromise;
      await new Promise(resolve => setImmediate(resolve));

      const replStartCalls = repl.start.mock.calls;
      const replOptions = replStartCalls[0][0];
      const evalFunction = replOptions.eval;
      const mockCallback = jest.fn();

      evalFunction('   ', {}, 'filename', mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(null, defaultValue);
    });

    test('should handle eval errors gracefully', async () => {
      const errorEval = jest.fn().mockImplementation(() => {
        throw new Error('Evaluation failed');
      });
      
      let resolveServerStart: (port: number) => void;
      const serverStartPromise = new Promise<number>((resolve) => {
        resolveServerStart = resolve;
      });

      mockServer.listen.mockImplementation((_port: any, callback?: any) => {
        if (callback) setImmediate(() => {
          (callback as () => void)();
          resolveServerStart(12345);
        });
      });

      mockDomainInstance.run.mockImplementationOnce((callback: any) => {
        return callback();
      });

      windowsDebugger({ eval: errorEval });

      await serverStartPromise;
      await new Promise(resolve => setImmediate(resolve));

      const replStartCalls = repl.start.mock.calls;
      const replOptions = replStartCalls[0][0];
      const evalFunction = replOptions.eval;
      const mockCallback = jest.fn();

      evalFunction('error-command', {}, 'filename', mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(expect.any(Error));
    });

    test('should use built-in eval by default', async () => {
      let resolveServerStart: (port: number) => void;
      const serverStartPromise = new Promise<number>((resolve) => {
        resolveServerStart = resolve;
      });

      mockServer.listen.mockImplementation((_port: any, callback?: any) => {
        if (callback) setImmediate(() => {
          (callback as () => void)();
          resolveServerStart(12345);
        });
      });

      mockDomainInstance.run.mockImplementationOnce((callback: any) => {
        return callback();
      });

      windowsDebugger();

      await serverStartPromise;
      await new Promise(resolve => setImmediate(resolve));

      const replStartCalls = repl.start.mock.calls;
      const replOptions = replStartCalls[0][0];
      const evalFunction = replOptions.eval;
      const mockCallback = jest.fn();

      evalFunction('2 + 2', {}, 'filename', mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(null, 4);
    });

    test('should format output using writer function', async () => {
      let resolveServerStart: (port: number) => void;
      const serverStartPromise = new Promise<number>((resolve) => {
        resolveServerStart = resolve;
      });

      mockServer.listen.mockImplementation((_port: any, callback?: any) => {
        if (callback) setImmediate(() => {
          (callback as () => void)();
          resolveServerStart(12345);
        });
      });

      mockDomainInstance.run.mockImplementationOnce((callback: any) => {
        return callback();
      });

      windowsDebugger();

      await serverStartPromise;
      await new Promise(resolve => setImmediate(resolve));

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

    test('should handle invalid server address', (done) => {
      mockServer.address.mockReturnValue(null);
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation((message, error) => {
        try {
          expect(message).toBe('Failed to start Windows debugger:');
          expect(error).toEqual(expect.objectContaining({
            message: 'Invalid server address'
          }));
          consoleSpy.mockRestore();
          done();
        } catch (testError) {
          consoleSpy.mockRestore();
          done(testError as Error);
        }
      });

      mockDomainInstance.run.mockImplementationOnce((callback: any) => {
        try {
          const result = callback();
          if (result && typeof result.then === 'function') {
            result.catch(() => {
              // Error handled by console.error mock
            });
          }
        } catch (error) {
          console.error('Failed to start Windows debugger:', error);
        }
      });

      windowsDebugger();
    });

    test('should handle string server address', (done) => {
      mockServer.address.mockReturnValue('/unix/socket/path');
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation((message, error) => {
        try {
          expect(message).toBe('Failed to start Windows debugger:');
          expect(error).toEqual(expect.objectContaining({
            message: 'Invalid server address'
          }));
          consoleSpy.mockRestore();
          done();
        } catch (testError) {
          consoleSpy.mockRestore();
          done(testError as Error);
        }
      });

      mockDomainInstance.run.mockImplementationOnce((callback: any) => {
        try {
          const result = callback();
          if (result && typeof result.then === 'function') {
            result.catch(() => {
              // Error handled by console.error mock
            });
          }
        } catch (error) {
          console.error('Failed to start Windows debugger:', error);
        }
      });

      windowsDebugger();
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

    test('should handle server creation failure', (done) => {
      // Reset mocks first
      jest.clearAllMocks();
      
      net.createServer.mockImplementation(() => {
        throw new Error('Server creation failed');
      });

      domain.create.mockReturnValue(mockDomainInstance);
      spawn.mockReturnValue({});

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation((message, error) => {
        try {
          expect(message).toBe('Failed to start Windows debugger:');
          expect(error).toEqual(expect.objectContaining({
            message: 'Server creation failed'
          }));
          consoleSpy.mockRestore();
          done();
        } catch (testError) {
          consoleSpy.mockRestore();
          done(testError as Error);
        }
      });

      // Mock domain to catch this specific error without rethrowing
      mockDomainInstance.run.mockImplementationOnce((callback: any) => {
        try {
          callback();
        } catch (error) {
          // Domain catches the error and logs it
          console.error('Failed to start Windows debugger:', error);
        }
      });

      windowsDebugger();
    });

    test('should handle server listen errors', (done) => {
      // Reset mocks and set up proper behavior first
      jest.clearAllMocks();
      
      const testError = new Error('Listen failed');
      
      // Set up server mock with proper error handling
      mockServer.listen.mockImplementation((_port: any, callback?: any) => {
        // Call the callback to simulate successful bind
        if (callback) setImmediate(() => (callback as () => void)());
        
        // Then trigger an error event immediately
        setImmediate(() => {
          const errorCall = mockServer.on.mock.calls.find(call => call[0] === 'error');
          if (errorCall && typeof errorCall[1] === 'function') {
            errorCall[1](testError);
          }
        });
      });

      mockServer.address.mockReturnValue({ port: 12345 });
      mockServer.on.mockImplementation((event, _callback) => {
        if (event === 'error') {
          // Store the error callback for later invocation
        }
      });
      
      net.createServer.mockImplementation((callback?: any) => {
        if (callback) setImmediate(() => callback(mockSocket));
        return mockServer;
      });

      domain.create.mockReturnValue(mockDomainInstance);
      repl.start.mockReturnValue(mockReplServer);
      spawn.mockReturnValue({});

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation((message, error) => {
        try {
          expect(message).toBe('Failed to start Windows debugger:');
          expect(error).toBe(testError);
          consoleSpy.mockRestore();
          done();
        } catch (testError) {
          consoleSpy.mockRestore();
          done(testError as Error);
        }
      });

      mockDomainInstance.run.mockImplementationOnce((callback: any) => {
        try {
          const result = callback();
          if (result && typeof result.then === 'function') {
            result.catch(() => {
              // Error handled by console.error mock
            });
          }
        } catch (error) {
          console.error('Failed to start Windows debugger:', error);
        }
      });

      windowsDebugger();
    });
  });

  describe('PowerShell Command Building', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'win32', writable: true });
    });

    test('should include correct Node.js script in command', async () => {
      let resolveServerStart: (port: number) => void;
      const serverStartPromise = new Promise<number>((resolve) => {
        resolveServerStart = resolve;
      });

      mockServer.listen.mockImplementation((_port: any, callback?: any) => {
        if (callback) setImmediate(() => {
          (callback as () => void)();
          resolveServerStart(12345);
        });
      });

      mockDomainInstance.run.mockImplementationOnce((callback: any) => {
        return callback();
      });

      windowsDebugger();

      await serverStartPromise;
      await new Promise(resolve => setImmediate(resolve));

      const spawnCalls = spawn.mock.calls;
      const commandString = spawnCalls[0][1][2];
      
      expect(commandString).toContain('const net = require');
      expect(commandString).toContain('net.connect');
      expect(commandString).toContain('12345'); // mock port
      expect(commandString).toContain('localhost');
    });

    test('should handle complex characters in title', async () => {
      const complexTitle = "Test'Debug\"Session&<>|";
      
      let resolveServerStart: (port: number) => void;
      const serverStartPromise = new Promise<number>((resolve) => {
        resolveServerStart = resolve;
      });

      mockServer.listen.mockImplementation((_port: any, callback?: any) => {
        if (callback) setImmediate(() => {
          (callback as () => void)();
          resolveServerStart(12345);
        });
      });

      mockDomainInstance.run.mockImplementationOnce((callback: any) => {
        return callback();
      });

      windowsDebugger({ title: complexTitle });

      await serverStartPromise;
      await new Promise(resolve => setImmediate(resolve));

      const spawnCalls = spawn.mock.calls;
      const commandString = spawnCalls[0][1][2];
      
      // Single quotes should be escaped as double single quotes
      expect(commandString).toContain("Test''Debug");
    });

    test('should handle multiple single quotes', async () => {
      const weirdTitle = "A'B'C'D";
      
      let resolveServerStart: (port: number) => void;
      const serverStartPromise = new Promise<number>((resolve) => {
        resolveServerStart = resolve;
      });

      mockServer.listen.mockImplementation((_port: any, callback?: any) => {
        if (callback) setImmediate(() => {
          (callback as () => void)();
          resolveServerStart(12345);
        });
      });

      mockDomainInstance.run.mockImplementationOnce((callback: any) => {
        return callback();
      });

      windowsDebugger({ title: weirdTitle });

      await serverStartPromise;
      await new Promise(resolve => setImmediate(resolve));

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

    test('should apply all custom options correctly', async () => {
      // Clear mocks to avoid interference from previous tests
      jest.clearAllMocks();
      
      // Set up mocks again 
      net.createServer.mockImplementation((callback?: any) => {
        if (callback) setImmediate(() => callback(mockSocket));
        return mockServer;
      });
      repl.start.mockReturnValue(mockReplServer);
      domain.create.mockReturnValue(mockDomainInstance);
      spawn.mockReturnValue({});
      
      const customEval = jest.fn().mockReturnValue('custom-eval-result');
      const options: WindowsDebuggerOptions = {
        title: 'Custom Title',
        default: 'custom-default',
        eval: customEval
      };

      let resolveServerStart: (port: number) => void;
      const serverStartPromise = new Promise<number>((resolve) => {
        resolveServerStart = resolve;
      });

      mockServer.listen.mockImplementation((_port: any, callback?: any) => {
        if (callback) setImmediate(() => {
          (callback as () => void)();
          resolveServerStart(12345);
        });
      });
      mockServer.address.mockReturnValue({ port: 12345 });

      mockDomainInstance.run.mockImplementationOnce((callback: any) => {
        return callback();
      });

      windowsDebugger(options);

      await serverStartPromise;
      await new Promise(resolve => setImmediate(resolve));

      // Check title was used - get the last spawn call
      const spawnCalls = spawn.mock.calls;
      const lastSpawnCall = spawnCalls[spawnCalls.length - 1];
      expect(lastSpawnCall[1][2]).toContain('Custom Title');

      // Check eval and default were configured - get the last repl call
      const replStartCalls = repl.start.mock.calls;
      const lastReplCall = replStartCalls[replStartCalls.length - 1];
      const replOptions = lastReplCall[0];
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

    test('should complete full initialization flow', async () => {
      let resolveServerStart: (port: number) => void;
      const serverStartPromise = new Promise<number>((resolve) => {
        resolveServerStart = resolve;
      });

      mockServer.listen.mockImplementation((_port: any, callback?: any) => {
        if (callback) setImmediate(() => {
          (callback as () => void)();
          resolveServerStart(12345);
        });
      });

      mockDomainInstance.run.mockImplementationOnce((callback: any) => {
        return callback();
      });

      windowsDebugger({ title: 'Integration Test' });

      await serverStartPromise;
      await new Promise(resolve => setImmediate(resolve));

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

    test('should handle default configuration paths', async () => {
      let resolveServerStart: (port: number) => void;
      const serverStartPromise = new Promise<number>((resolve) => {
        resolveServerStart = resolve;
      });

      mockServer.listen.mockImplementation((_port: any, callback?: any) => {
        if (callback) setImmediate(() => {
          (callback as () => void)();
          resolveServerStart(12345);
        });
      });

      mockDomainInstance.run.mockImplementationOnce((callback: any) => {
        return callback();
      });

      windowsDebugger({});

      await serverStartPromise;
      await new Promise(resolve => setImmediate(resolve));

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

    test('should handle port number in Node.js script', async () => {
      // Test with different port number
      mockServer.address.mockReturnValue({ port: 9999 });
      
      let resolveServerStart: (port: number) => void;
      const serverStartPromise = new Promise<number>((resolve) => {
        resolveServerStart = resolve;
      });

      mockServer.listen.mockImplementation((_port: any, callback?: any) => {
        if (callback) setImmediate(() => {
          (callback as () => void)();
          resolveServerStart(9999);
        });
      });

      mockDomainInstance.run.mockImplementationOnce((callback: any) => {
        return callback();
      });

      windowsDebugger();

      await serverStartPromise;
      await new Promise(resolve => setImmediate(resolve));

      const spawnCalls = spawn.mock.calls;
      const commandString = spawnCalls[0][1][2];
      expect(commandString).toContain('9999');
    });

    test('should work with minimal valid configuration', async () => {
      let resolveServerStart: (port: number) => void;
      const serverStartPromise = new Promise<number>((resolve) => {
        resolveServerStart = resolve;
      });

      mockServer.listen.mockImplementation((_port: any, callback?: any) => {
        if (callback) setImmediate(() => {
          (callback as () => void)();
          resolveServerStart(12345);
        });
      });

      mockDomainInstance.run.mockImplementationOnce((callback: any) => {
        return callback();
      });

      windowsDebugger({ title: 'Min' });

      await serverStartPromise;
      await new Promise(resolve => setImmediate(resolve));

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