import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Simple mock interfaces
interface MockServer {
  listen: jest.Mock;
  address: jest.Mock;
  close: jest.Mock;
  on: jest.Mock;
}

interface MockSocket {
  pipe: jest.Mock;
  on: jest.Mock;
  write: jest.Mock;
  end: jest.Mock;
}

interface MockReplServer {
  on: jest.Mock;
  close: jest.Mock;
}

interface MockDomain {
  run: jest.Mock;
  on: jest.Mock;
}

// Mock implementations
const createMockServer = (): MockServer => ({
  listen: jest.fn(),
  address: jest.fn().mockReturnValue({ port: 12345 }),
  close: jest.fn(),
  on: jest.fn()
});

const createMockSocket = (): MockSocket => ({
  pipe: jest.fn(),
  on: jest.fn(), 
  write: jest.fn(),
  end: jest.fn()
});

const createMockReplServer = (): MockReplServer => ({
  on: jest.fn(),
  close: jest.fn()
});

const createMockDomain = (): MockDomain => ({
  run: jest.fn(),
  on: jest.fn()
});

// Module mocks
jest.mock('net');
jest.mock('repl');
jest.mock('domain');
jest.mock('child_process');

import windowsDebugger, { WindowsDebuggerOptions } from '../src/index';

describe('Windows Debugger', () => {
  let originalPlatform: string;
  let mockServer: MockServer;
  let mockSocket: MockSocket;
  let mockReplServer: MockReplServer;
  let mockDomainInstance: MockDomain;

  // Import mocked modules
  const net = require('net');
  const repl = require('repl');
  const domain = require('domain');
  const { spawn } = require('child_process');

  beforeEach(() => {
    jest.clearAllMocks();
    
    originalPlatform = process.platform;
    
    // Create fresh mocks
    mockServer = createMockServer();
    mockSocket = createMockSocket();
    mockReplServer = createMockReplServer();
    mockDomainInstance = createMockDomain();

    // Setup mock behaviors with any types to avoid TypeScript strict checking
    (mockServer.listen as any).mockImplementation((_port: any, callback?: any) => {
      if (callback) setImmediate(callback);
    });

    (mockDomainInstance.run as any).mockImplementation((callback: any) => {
      callback();
    });

    // Setup module mocks
    (net.createServer as any) = jest.fn().mockImplementation((callback?: any) => {
      if (callback) setImmediate(() => callback(mockSocket));
      return mockServer;
    });

    repl.start = jest.fn().mockReturnValue(mockReplServer);
    domain.create = jest.fn().mockReturnValue(mockDomainInstance);
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
      
      expect(() => windowsDebugger()).toThrow('This module only works on Windows.');
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

    test('should create server and spawn PowerShell with default options', () => {
      windowsDebugger();

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

    test('should use custom title in PowerShell command', () => {
      const customTitle = 'My Custom Debugger';
      windowsDebugger({ title: customTitle });

      const spawnCalls = spawn.mock.calls;
      expect(spawnCalls).toHaveLength(1);
      const commandString = spawnCalls[0][1][2];
      expect(commandString).toContain(customTitle);
    });

    test('should escape single quotes in title', () => {
      const titleWithQuotes = "Debug'Session'Test";
      windowsDebugger({ title: titleWithQuotes });

      const spawnCalls = spawn.mock.calls;
      const commandString = spawnCalls[0][1][2];
      expect(commandString).toContain("Debug''Session''Test");
    });

    test('should start REPL server on socket connection', () => {
      windowsDebugger();

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

  describe('REPL Evaluation', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'win32', writable: true });
    });

    test('should use custom eval function', () => {
      const customEval = jest.fn().mockReturnValue('test-result');
      windowsDebugger({ eval: customEval });

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

    test('should handle eval errors', () => {
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

    test('should handle server listen errors', (done) => {
      const testError = new Error('Listen failed');
      (mockServer.listen as any).mockImplementation((_port: any, callback?: any) => {
        if (callback) callback();
        setImmediate(() => {
          const errorCall = mockServer.on.mock.calls.find((call: any[]) => call[0] === 'error');
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
      }, 50);
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

      const errorCall = mockDomainInstance.on.mock.calls.find((call: any[]) => call[0] === 'error');
      
      expect(() => {
        if (errorCall && typeof errorCall[1] === 'function') {
          errorCall[1](new Error('Domain error'));
        }
      }).not.toThrow();
    });

    test('should handle server creation failure', () => {
      (net.createServer as any).mockImplementation(() => {
        throw new Error('Server creation failed');
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Mock domain run to catch the error without re-throwing
      (mockDomainInstance.run as any).mockImplementation((callback: any) => {
        try {
          callback();
        } catch (error) {
          // Error caught by domain, should not re-throw
        }
      });

      // Call should not throw because domain catches it
      windowsDebugger();
      
      consoleSpy.mockRestore();
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
  });

  describe('Options Handling', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'win32', writable: true });
    });

    test('should accept empty options', () => {
      expect(() => windowsDebugger({})).not.toThrow();
    });

    test('should accept undefined options', () => {
      expect(() => windowsDebugger()).not.toThrow();
    });

    test('should apply all custom options', () => {
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

  describe('Integration Tests', () => {
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

  describe('Edge Cases', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'win32', writable: true });
    });

    test('should handle all default configuration paths', () => {
      // Test applyDefaults with empty object
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

    test('should handle PowerShell command escaping edge cases', () => {
      // Test title with multiple single quotes
      const weirdTitle = "A'B'C'D";
      windowsDebugger({ title: weirdTitle });

      const spawnCalls = spawn.mock.calls;
      const commandString = spawnCalls[0][1][2];
      expect(commandString).toContain("A''B''C''D");
    });

    test('should handle port number in Node.js script', () => {
      // Test with different port number
      mockServer.address.mockReturnValue({ port: 9999 });
      windowsDebugger();

      const spawnCalls = spawn.mock.calls;
      const commandString = spawnCalls[0][1][2];
      expect(commandString).toContain('9999');
    });
  });
});