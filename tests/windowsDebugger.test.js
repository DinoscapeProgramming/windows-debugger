"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
// Mock modules before importing them
const mockServer = {
    listen: globals_1.jest.fn(),
    address: globals_1.jest.fn().mockReturnValue({ port: 12345 }),
    close: globals_1.jest.fn(),
    on: globals_1.jest.fn()
};
const mockSocket = {
    pipe: globals_1.jest.fn(),
    on: globals_1.jest.fn(),
    write: globals_1.jest.fn(),
    end: globals_1.jest.fn()
};
const mockReplServer = {
    on: globals_1.jest.fn(),
    close: globals_1.jest.fn()
};
const mockDomainInstance = {
    run: globals_1.jest.fn(),
    on: globals_1.jest.fn()
};
// Mock the modules completely
globals_1.jest.mock('net', () => ({
    createServer: globals_1.jest.fn()
}));
globals_1.jest.mock('repl', () => ({
    start: globals_1.jest.fn()
}));
globals_1.jest.mock('domain', () => ({
    create: globals_1.jest.fn()
}));
globals_1.jest.mock('child_process', () => ({
    spawn: globals_1.jest.fn()
}));
// Import after mocking
const index_1 = __importDefault(require("../src/index"));
(0, globals_1.describe)('Windows Debugger', () => {
    let originalPlatform;
    // Get the mocked modules
    const net = require('net');
    const repl = require('repl');
    const domain = require('domain');
    const { spawn } = require('child_process');
    (0, globals_1.beforeEach)(() => {
        globals_1.jest.clearAllMocks();
        originalPlatform = process.platform;
        // Reset mock implementations
        mockServer.listen.mockReset();
        mockServer.address.mockReset().mockReturnValue({ port: 12345 });
        mockServer.on.mockReset();
        mockDomainInstance.run.mockReset();
        mockDomainInstance.on.mockReset();
        // Setup default behaviors
        mockServer.listen.mockImplementation((_port, callback) => {
            if (callback) {
                // Simulate async server start
                setImmediate(() => callback());
            }
            // Return the mock server for chaining
            return mockServer;
        });
        mockDomainInstance.run.mockImplementation((callback) => {
            // Always run the callback and return its result, but catch errors strategically
            try {
                const result = callback();
                // If the callback returns a promise, we need to handle it
                if (result && typeof result.then === 'function') {
                    // For testing purposes, we'll await the promise but catch any errors
                    result.catch((error) => {
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
            }
            catch (error) {
                // Only suppress specific server-related errors, not platform validation errors 
                const stackTrace = error.stack || '';
                if (stackTrace.includes('Server creation failed')) {
                    // This is an expected error in test cases - suppress it
                    return;
                }
                // Re-throw all other errors (including platform validation errors)
                throw error;
            }
        });
        // Setup module mocks
        net.createServer.mockImplementation((callback) => {
            if (callback)
                setImmediate(() => callback(mockSocket));
            return mockServer;
        });
        repl.start.mockReturnValue(mockReplServer);
        domain.create.mockReturnValue(mockDomainInstance);
        spawn.mockReturnValue({});
    });
    (0, globals_1.afterEach)(() => {
        Object.defineProperty(process, 'platform', {
            value: originalPlatform,
            writable: true
        });
    });
    (0, globals_1.describe)('Platform Validation', () => {
        (0, globals_1.test)('should throw error on non-Windows platforms', (done) => {
            // Set Linux platform  
            Object.defineProperty(process, 'platform', { value: 'linux', writable: true });
            // Mock console.error to capture the error and finish the test
            const consoleSpy = globals_1.jest.spyOn(console, 'error').mockImplementation((message, error) => {
                try {
                    (0, globals_1.expect)(message).toBe('Failed to start Windows debugger:');
                    (0, globals_1.expect)(error).toEqual(globals_1.expect.objectContaining({
                        message: 'This module only works on Windows.'
                    }));
                    consoleSpy.mockRestore();
                    done();
                }
                catch (testError) {
                    consoleSpy.mockRestore();
                    done(testError);
                }
            });
            // Mock domain to NOT suppress any errors - let them flow to console.error
            mockDomainInstance.run.mockImplementationOnce((callback) => {
                try {
                    const result = callback();
                    // Handle promise rejection case  
                    if (result && typeof result.then === 'function') {
                        result.catch(() => {
                            // Error already handled by console.error mock
                        });
                    }
                }
                catch (error) {
                    // Error should be caught and logged by the actual code
                    console.error('Failed to start Windows debugger:', error);
                }
            });
            // This should trigger the error flow
            (0, index_1.default)();
        });
        (0, globals_1.test)('should work on Windows platform', () => {
            Object.defineProperty(process, 'platform', { value: 'win32', writable: true });
            // Mock domain to handle async operations normally
            mockDomainInstance.run.mockImplementationOnce((callback) => {
                return callback();
            });
            (0, globals_1.expect)(() => (0, index_1.default)()).not.toThrow();
        });
    });
    (0, globals_1.describe)('Basic Functionality', () => {
        (0, globals_1.beforeEach)(() => {
            Object.defineProperty(process, 'platform', { value: 'win32', writable: true });
        });
        (0, globals_1.test)('should create server and spawn PowerShell with default options', async () => {
            // Set up promise resolution tracking
            let resolveServerStart;
            const serverStartPromise = new Promise((resolve) => {
                resolveServerStart = resolve;
            });
            // Mock server listen to resolve with port
            mockServer.listen.mockImplementation((_port, callback) => {
                if (callback)
                    setImmediate(() => {
                        callback();
                        resolveServerStart(12345);
                    });
            });
            // Mock domain run to handle async operation
            mockDomainInstance.run.mockImplementationOnce((callback) => {
                return callback();
            });
            (0, index_1.default)();
            // Wait for async operations to complete
            await serverStartPromise;
            await new Promise(resolve => setImmediate(resolve));
            (0, globals_1.expect)(net.createServer).toHaveBeenCalled();
            (0, globals_1.expect)(domain.create).toHaveBeenCalled();
            (0, globals_1.expect)(mockDomainInstance.run).toHaveBeenCalled();
            (0, globals_1.expect)(mockServer.listen).toHaveBeenCalledWith(0, globals_1.expect.any(Function));
            (0, globals_1.expect)(spawn).toHaveBeenCalledWith('powershell.exe', globals_1.expect.arrayContaining(['-NoExit', '-Command']), globals_1.expect.objectContaining({
                cwd: process.cwd(),
                shell: true,
                detached: true,
                stdio: 'ignore'
            }));
        });
        (0, globals_1.test)('should use custom title in PowerShell command', async () => {
            const customTitle = 'My Custom Debugger';
            let resolveServerStart;
            const serverStartPromise = new Promise((resolve) => {
                resolveServerStart = resolve;
            });
            mockServer.listen.mockImplementation((_port, callback) => {
                if (callback)
                    setImmediate(() => {
                        callback();
                        resolveServerStart(12345);
                    });
            });
            mockDomainInstance.run.mockImplementationOnce((callback) => {
                return callback();
            });
            (0, index_1.default)({ title: customTitle });
            await serverStartPromise;
            await new Promise(resolve => setImmediate(resolve));
            const spawnCalls = spawn.mock.calls;
            (0, globals_1.expect)(spawnCalls).toHaveLength(1);
            const commandString = spawnCalls[0][1][2];
            (0, globals_1.expect)(commandString).toContain(customTitle);
        });
        (0, globals_1.test)('should escape single quotes in title', async () => {
            const titleWithQuotes = "Debug'Session'Test";
            let resolveServerStart;
            const serverStartPromise = new Promise((resolve) => {
                resolveServerStart = resolve;
            });
            mockServer.listen.mockImplementation((_port, callback) => {
                if (callback)
                    setImmediate(() => {
                        callback();
                        resolveServerStart(12345);
                    });
            });
            mockDomainInstance.run.mockImplementationOnce((callback) => {
                return callback();
            });
            (0, index_1.default)({ title: titleWithQuotes });
            await serverStartPromise;
            await new Promise(resolve => setImmediate(resolve));
            const spawnCalls = spawn.mock.calls;
            const commandString = spawnCalls[0][1][2];
            (0, globals_1.expect)(commandString).toContain("Debug''Session''Test");
        });
        (0, globals_1.test)('should start REPL server on socket connection', async () => {
            let resolveServerStart;
            const serverStartPromise = new Promise((resolve) => {
                resolveServerStart = resolve;
            });
            mockServer.listen.mockImplementation((_port, callback) => {
                if (callback)
                    setImmediate(() => {
                        callback();
                        resolveServerStart(12345);
                    });
            });
            mockDomainInstance.run.mockImplementationOnce((callback) => {
                return callback();
            });
            (0, index_1.default)();
            await serverStartPromise;
            await new Promise(resolve => setImmediate(resolve));
            (0, globals_1.expect)(repl.start).toHaveBeenCalledWith(globals_1.expect.objectContaining({
                input: mockSocket,
                output: mockSocket,
                terminal: false,
                prompt: '> ',
                eval: globals_1.expect.any(Function),
                writer: globals_1.expect.any(Function)
            }));
        });
    });
    (0, globals_1.describe)('REPL Evaluation Functions', () => {
        (0, globals_1.beforeEach)(() => {
            Object.defineProperty(process, 'platform', { value: 'win32', writable: true });
        });
        (0, globals_1.test)('should use custom eval function', async () => {
            const customEval = globals_1.jest.fn().mockReturnValue('test-result');
            let resolveServerStart;
            const serverStartPromise = new Promise((resolve) => {
                resolveServerStart = resolve;
            });
            mockServer.listen.mockImplementation((_port, callback) => {
                if (callback)
                    setImmediate(() => {
                        callback();
                        resolveServerStart(12345);
                    });
            });
            mockDomainInstance.run.mockImplementationOnce((callback) => {
                return callback();
            });
            (0, index_1.default)({ eval: customEval });
            await serverStartPromise;
            await new Promise(resolve => setImmediate(resolve));
            const replStartCalls = repl.start.mock.calls;
            (0, globals_1.expect)(replStartCalls).toHaveLength(1);
            const replOptions = replStartCalls[0][0];
            const evalFunction = replOptions.eval;
            const mockCallback = globals_1.jest.fn();
            evalFunction('test-command', {}, 'filename', mockCallback);
            (0, globals_1.expect)(customEval).toHaveBeenCalledWith('test-command');
            (0, globals_1.expect)(mockCallback).toHaveBeenCalledWith(null, 'test-result');
        });
        (0, globals_1.test)('should return default value for empty command', async () => {
            const defaultValue = 'default-value';
            let resolveServerStart;
            const serverStartPromise = new Promise((resolve) => {
                resolveServerStart = resolve;
            });
            mockServer.listen.mockImplementation((_port, callback) => {
                if (callback)
                    setImmediate(() => {
                        callback();
                        resolveServerStart(12345);
                    });
            });
            mockDomainInstance.run.mockImplementationOnce((callback) => {
                return callback();
            });
            (0, index_1.default)({ default: defaultValue });
            await serverStartPromise;
            await new Promise(resolve => setImmediate(resolve));
            const replStartCalls = repl.start.mock.calls;
            const replOptions = replStartCalls[0][0];
            const evalFunction = replOptions.eval;
            const mockCallback = globals_1.jest.fn();
            evalFunction('   ', {}, 'filename', mockCallback);
            (0, globals_1.expect)(mockCallback).toHaveBeenCalledWith(null, defaultValue);
        });
        (0, globals_1.test)('should handle eval errors gracefully', async () => {
            const errorEval = globals_1.jest.fn().mockImplementation(() => {
                throw new Error('Evaluation failed');
            });
            let resolveServerStart;
            const serverStartPromise = new Promise((resolve) => {
                resolveServerStart = resolve;
            });
            mockServer.listen.mockImplementation((_port, callback) => {
                if (callback)
                    setImmediate(() => {
                        callback();
                        resolveServerStart(12345);
                    });
            });
            mockDomainInstance.run.mockImplementationOnce((callback) => {
                return callback();
            });
            (0, index_1.default)({ eval: errorEval });
            await serverStartPromise;
            await new Promise(resolve => setImmediate(resolve));
            const replStartCalls = repl.start.mock.calls;
            const replOptions = replStartCalls[0][0];
            const evalFunction = replOptions.eval;
            const mockCallback = globals_1.jest.fn();
            evalFunction('error-command', {}, 'filename', mockCallback);
            (0, globals_1.expect)(mockCallback).toHaveBeenCalledWith(globals_1.expect.any(Error));
        });
        (0, globals_1.test)('should use built-in eval by default', async () => {
            let resolveServerStart;
            const serverStartPromise = new Promise((resolve) => {
                resolveServerStart = resolve;
            });
            mockServer.listen.mockImplementation((_port, callback) => {
                if (callback)
                    setImmediate(() => {
                        callback();
                        resolveServerStart(12345);
                    });
            });
            mockDomainInstance.run.mockImplementationOnce((callback) => {
                return callback();
            });
            (0, index_1.default)();
            await serverStartPromise;
            await new Promise(resolve => setImmediate(resolve));
            const replStartCalls = repl.start.mock.calls;
            const replOptions = replStartCalls[0][0];
            const evalFunction = replOptions.eval;
            const mockCallback = globals_1.jest.fn();
            evalFunction('2 + 2', {}, 'filename', mockCallback);
            (0, globals_1.expect)(mockCallback).toHaveBeenCalledWith(null, 4);
        });
        (0, globals_1.test)('should format output using writer function', async () => {
            let resolveServerStart;
            const serverStartPromise = new Promise((resolve) => {
                resolveServerStart = resolve;
            });
            mockServer.listen.mockImplementation((_port, callback) => {
                if (callback)
                    setImmediate(() => {
                        callback();
                        resolveServerStart(12345);
                    });
            });
            mockDomainInstance.run.mockImplementationOnce((callback) => {
                return callback();
            });
            (0, index_1.default)();
            await serverStartPromise;
            await new Promise(resolve => setImmediate(resolve));
            const replStartCalls = repl.start.mock.calls;
            const replOptions = replStartCalls[0][0];
            const writerFunction = replOptions.writer;
            const testObject = { key: 'value', nested: { array: [1, 2, 3] } };
            const result = writerFunction(testObject);
            (0, globals_1.expect)(typeof result).toBe('string');
            (0, globals_1.expect)(result).toContain('key');
            (0, globals_1.expect)(result).toContain('value');
        });
    });
    (0, globals_1.describe)('Error Handling', () => {
        (0, globals_1.beforeEach)(() => {
            Object.defineProperty(process, 'platform', { value: 'win32', writable: true });
        });
        (0, globals_1.test)('should handle invalid server address', (done) => {
            mockServer.address.mockReturnValue(null);
            const consoleSpy = globals_1.jest.spyOn(console, 'error').mockImplementation((message, error) => {
                try {
                    (0, globals_1.expect)(message).toBe('Failed to start Windows debugger:');
                    (0, globals_1.expect)(error).toEqual(globals_1.expect.objectContaining({
                        message: 'Invalid server address'
                    }));
                    consoleSpy.mockRestore();
                    done();
                }
                catch (testError) {
                    consoleSpy.mockRestore();
                    done(testError);
                }
            });
            mockDomainInstance.run.mockImplementationOnce((callback) => {
                try {
                    const result = callback();
                    if (result && typeof result.then === 'function') {
                        result.catch(() => {
                            // Error handled by console.error mock
                        });
                    }
                }
                catch (error) {
                    console.error('Failed to start Windows debugger:', error);
                }
            });
            (0, index_1.default)();
        });
        (0, globals_1.test)('should handle string server address', (done) => {
            mockServer.address.mockReturnValue('/unix/socket/path');
            const consoleSpy = globals_1.jest.spyOn(console, 'error').mockImplementation((message, error) => {
                try {
                    (0, globals_1.expect)(message).toBe('Failed to start Windows debugger:');
                    (0, globals_1.expect)(error).toEqual(globals_1.expect.objectContaining({
                        message: 'Invalid server address'
                    }));
                    consoleSpy.mockRestore();
                    done();
                }
                catch (testError) {
                    consoleSpy.mockRestore();
                    done(testError);
                }
            });
            mockDomainInstance.run.mockImplementationOnce((callback) => {
                try {
                    const result = callback();
                    if (result && typeof result.then === 'function') {
                        result.catch(() => {
                            // Error handled by console.error mock
                        });
                    }
                }
                catch (error) {
                    console.error('Failed to start Windows debugger:', error);
                }
            });
            (0, index_1.default)();
        });
        (0, globals_1.test)('should handle domain errors silently', () => {
            (0, index_1.default)();
            const errorCall = mockDomainInstance.on.mock.calls.find(call => call[0] === 'error');
            (0, globals_1.expect)(() => {
                if (errorCall && typeof errorCall[1] === 'function') {
                    errorCall[1](new Error('Domain error'));
                }
            }).not.toThrow();
        });
        (0, globals_1.test)('should handle server creation failure', (done) => {
            // Reset mocks first
            globals_1.jest.clearAllMocks();
            net.createServer.mockImplementation(() => {
                throw new Error('Server creation failed');
            });
            domain.create.mockReturnValue(mockDomainInstance);
            spawn.mockReturnValue({});
            const consoleSpy = globals_1.jest.spyOn(console, 'error').mockImplementation((message, error) => {
                try {
                    (0, globals_1.expect)(message).toBe('Failed to start Windows debugger:');
                    (0, globals_1.expect)(error).toEqual(globals_1.expect.objectContaining({
                        message: 'Server creation failed'
                    }));
                    consoleSpy.mockRestore();
                    done();
                }
                catch (testError) {
                    consoleSpy.mockRestore();
                    done(testError);
                }
            });
            // Mock domain to catch this specific error without rethrowing
            mockDomainInstance.run.mockImplementationOnce((callback) => {
                try {
                    callback();
                }
                catch (error) {
                    // Domain catches the error and logs it
                    console.error('Failed to start Windows debugger:', error);
                }
            });
            (0, index_1.default)();
        });
        (0, globals_1.test)('should handle server listen errors', (done) => {
            // Reset mocks and set up proper behavior first
            globals_1.jest.clearAllMocks();
            const testError = new Error('Listen failed');
            // Set up server mock with proper error handling
            mockServer.listen.mockImplementation((_port, callback) => {
                // Call the callback to simulate successful bind
                if (callback)
                    setImmediate(() => callback());
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
            net.createServer.mockImplementation((callback) => {
                if (callback)
                    setImmediate(() => callback(mockSocket));
                return mockServer;
            });
            domain.create.mockReturnValue(mockDomainInstance);
            repl.start.mockReturnValue(mockReplServer);
            spawn.mockReturnValue({});
            const consoleSpy = globals_1.jest.spyOn(console, 'error').mockImplementation((message, error) => {
                try {
                    (0, globals_1.expect)(message).toBe('Failed to start Windows debugger:');
                    (0, globals_1.expect)(error).toBe(testError);
                    consoleSpy.mockRestore();
                    done();
                }
                catch (testError) {
                    consoleSpy.mockRestore();
                    done(testError);
                }
            });
            mockDomainInstance.run.mockImplementationOnce((callback) => {
                try {
                    const result = callback();
                    if (result && typeof result.then === 'function') {
                        result.catch(() => {
                            // Error handled by console.error mock
                        });
                    }
                }
                catch (error) {
                    console.error('Failed to start Windows debugger:', error);
                }
            });
            (0, index_1.default)();
        });
    });
    (0, globals_1.describe)('PowerShell Command Building', () => {
        (0, globals_1.beforeEach)(() => {
            Object.defineProperty(process, 'platform', { value: 'win32', writable: true });
        });
        (0, globals_1.test)('should include correct Node.js script in command', async () => {
            let resolveServerStart;
            const serverStartPromise = new Promise((resolve) => {
                resolveServerStart = resolve;
            });
            mockServer.listen.mockImplementation((_port, callback) => {
                if (callback)
                    setImmediate(() => {
                        callback();
                        resolveServerStart(12345);
                    });
            });
            mockDomainInstance.run.mockImplementationOnce((callback) => {
                return callback();
            });
            (0, index_1.default)();
            await serverStartPromise;
            await new Promise(resolve => setImmediate(resolve));
            const spawnCalls = spawn.mock.calls;
            const commandString = spawnCalls[0][1][2];
            (0, globals_1.expect)(commandString).toContain('const net = require');
            (0, globals_1.expect)(commandString).toContain('net.connect');
            (0, globals_1.expect)(commandString).toContain('12345'); // mock port
            (0, globals_1.expect)(commandString).toContain('localhost');
        });
        (0, globals_1.test)('should handle complex characters in title', async () => {
            const complexTitle = "Test'Debug\"Session&<>|";
            let resolveServerStart;
            const serverStartPromise = new Promise((resolve) => {
                resolveServerStart = resolve;
            });
            mockServer.listen.mockImplementation((_port, callback) => {
                if (callback)
                    setImmediate(() => {
                        callback();
                        resolveServerStart(12345);
                    });
            });
            mockDomainInstance.run.mockImplementationOnce((callback) => {
                return callback();
            });
            (0, index_1.default)({ title: complexTitle });
            await serverStartPromise;
            await new Promise(resolve => setImmediate(resolve));
            const spawnCalls = spawn.mock.calls;
            const commandString = spawnCalls[0][1][2];
            // Single quotes should be escaped as double single quotes
            (0, globals_1.expect)(commandString).toContain("Test''Debug");
        });
        (0, globals_1.test)('should handle multiple single quotes', async () => {
            const weirdTitle = "A'B'C'D";
            let resolveServerStart;
            const serverStartPromise = new Promise((resolve) => {
                resolveServerStart = resolve;
            });
            mockServer.listen.mockImplementation((_port, callback) => {
                if (callback)
                    setImmediate(() => {
                        callback();
                        resolveServerStart(12345);
                    });
            });
            mockDomainInstance.run.mockImplementationOnce((callback) => {
                return callback();
            });
            (0, index_1.default)({ title: weirdTitle });
            await serverStartPromise;
            await new Promise(resolve => setImmediate(resolve));
            const spawnCalls = spawn.mock.calls;
            const commandString = spawnCalls[0][1][2];
            (0, globals_1.expect)(commandString).toContain("A''B''C''D");
        });
    });
    (0, globals_1.describe)('Options Handling', () => {
        (0, globals_1.beforeEach)(() => {
            Object.defineProperty(process, 'platform', { value: 'win32', writable: true });
        });
        (0, globals_1.test)('should accept empty options object', () => {
            (0, globals_1.expect)(() => (0, index_1.default)({})).not.toThrow();
        });
        (0, globals_1.test)('should accept undefined options', () => {
            (0, globals_1.expect)(() => (0, index_1.default)()).not.toThrow();
        });
        (0, globals_1.test)('should apply all custom options correctly', async () => {
            // Clear mocks to avoid interference from previous tests
            globals_1.jest.clearAllMocks();
            // Set up mocks again 
            net.createServer.mockImplementation((callback) => {
                if (callback)
                    setImmediate(() => callback(mockSocket));
                return mockServer;
            });
            repl.start.mockReturnValue(mockReplServer);
            domain.create.mockReturnValue(mockDomainInstance);
            spawn.mockReturnValue({});
            const customEval = globals_1.jest.fn().mockReturnValue('custom-eval-result');
            const options = {
                title: 'Custom Title',
                default: 'custom-default',
                eval: customEval
            };
            let resolveServerStart;
            const serverStartPromise = new Promise((resolve) => {
                resolveServerStart = resolve;
            });
            mockServer.listen.mockImplementation((_port, callback) => {
                if (callback)
                    setImmediate(() => {
                        callback();
                        resolveServerStart(12345);
                    });
            });
            mockServer.address.mockReturnValue({ port: 12345 });
            mockDomainInstance.run.mockImplementationOnce((callback) => {
                return callback();
            });
            (0, index_1.default)(options);
            await serverStartPromise;
            await new Promise(resolve => setImmediate(resolve));
            // Check title was used - get the last spawn call
            const spawnCalls = spawn.mock.calls;
            const lastSpawnCall = spawnCalls[spawnCalls.length - 1];
            (0, globals_1.expect)(lastSpawnCall[1][2]).toContain('Custom Title');
            // Check eval and default were configured - get the last repl call
            const replStartCalls = repl.start.mock.calls;
            const lastReplCall = replStartCalls[replStartCalls.length - 1];
            const replOptions = lastReplCall[0];
            const mockCallback = globals_1.jest.fn();
            // Test custom eval
            replOptions.eval('test', {}, 'file', mockCallback);
            (0, globals_1.expect)(customEval).toHaveBeenCalledWith('test');
            // Test default value for empty command  
            mockCallback.mockClear();
            replOptions.eval('  ', {}, 'file', mockCallback);
            (0, globals_1.expect)(mockCallback).toHaveBeenCalledWith(null, 'custom-default');
        });
    });
    (0, globals_1.describe)('Module Exports', () => {
        (0, globals_1.test)('should export default function', () => {
            (0, globals_1.expect)(typeof index_1.default).toBe('function');
        });
        (0, globals_1.test)('should have CommonJS compatibility', () => {
            const commonJsExports = require('../src/index');
            (0, globals_1.expect)(typeof commonJsExports).toBe('function');
            (0, globals_1.expect)(typeof commonJsExports.default).toBe('function');
            (0, globals_1.expect)(commonJsExports).toBe(commonJsExports.default);
        });
    });
    (0, globals_1.describe)('Integration and Edge Cases', () => {
        (0, globals_1.beforeEach)(() => {
            Object.defineProperty(process, 'platform', { value: 'win32', writable: true });
        });
        (0, globals_1.test)('should complete full initialization flow', async () => {
            let resolveServerStart;
            const serverStartPromise = new Promise((resolve) => {
                resolveServerStart = resolve;
            });
            mockServer.listen.mockImplementation((_port, callback) => {
                if (callback)
                    setImmediate(() => {
                        callback();
                        resolveServerStart(12345);
                    });
            });
            mockDomainInstance.run.mockImplementationOnce((callback) => {
                return callback();
            });
            (0, index_1.default)({ title: 'Integration Test' });
            await serverStartPromise;
            await new Promise(resolve => setImmediate(resolve));
            // Verify complete flow
            (0, globals_1.expect)(domain.create).toHaveBeenCalled();
            (0, globals_1.expect)(mockDomainInstance.on).toHaveBeenCalledWith('error', globals_1.expect.any(Function));
            (0, globals_1.expect)(mockDomainInstance.run).toHaveBeenCalled();
            (0, globals_1.expect)(net.createServer).toHaveBeenCalled();
            (0, globals_1.expect)(mockServer.listen).toHaveBeenCalledWith(0, globals_1.expect.any(Function));
            (0, globals_1.expect)(mockServer.address).toHaveBeenCalled();
            (0, globals_1.expect)(spawn).toHaveBeenCalled();
            (0, globals_1.expect)(repl.start).toHaveBeenCalled();
        });
        (0, globals_1.test)('should handle default configuration paths', async () => {
            let resolveServerStart;
            const serverStartPromise = new Promise((resolve) => {
                resolveServerStart = resolve;
            });
            mockServer.listen.mockImplementation((_port, callback) => {
                if (callback)
                    setImmediate(() => {
                        callback();
                        resolveServerStart(12345);
                    });
            });
            mockDomainInstance.run.mockImplementationOnce((callback) => {
                return callback();
            });
            (0, index_1.default)({});
            await serverStartPromise;
            await new Promise(resolve => setImmediate(resolve));
            const spawnCalls = spawn.mock.calls;
            (0, globals_1.expect)(spawnCalls[0][1][2]).toContain('Windows Debugger'); // default title
            const replStartCalls = repl.start.mock.calls;
            const replOptions = replStartCalls[0][0];
            const mockCallback = globals_1.jest.fn();
            // Test default eval (should use built-in eval)
            replOptions.eval('1 + 1', {}, 'file', mockCallback);
            (0, globals_1.expect)(mockCallback).toHaveBeenCalledWith(null, 2);
            // Test default value (undefined)
            mockCallback.mockClear();
            replOptions.eval('', {}, 'file', mockCallback);
            (0, globals_1.expect)(mockCallback).toHaveBeenCalledWith(null, undefined);
        });
        (0, globals_1.test)('should handle port number in Node.js script', async () => {
            // Test with different port number
            mockServer.address.mockReturnValue({ port: 9999 });
            let resolveServerStart;
            const serverStartPromise = new Promise((resolve) => {
                resolveServerStart = resolve;
            });
            mockServer.listen.mockImplementation((_port, callback) => {
                if (callback)
                    setImmediate(() => {
                        callback();
                        resolveServerStart(9999);
                    });
            });
            mockDomainInstance.run.mockImplementationOnce((callback) => {
                return callback();
            });
            (0, index_1.default)();
            await serverStartPromise;
            await new Promise(resolve => setImmediate(resolve));
            const spawnCalls = spawn.mock.calls;
            const commandString = spawnCalls[0][1][2];
            (0, globals_1.expect)(commandString).toContain('9999');
        });
        (0, globals_1.test)('should work with minimal valid configuration', async () => {
            let resolveServerStart;
            const serverStartPromise = new Promise((resolve) => {
                resolveServerStart = resolve;
            });
            mockServer.listen.mockImplementation((_port, callback) => {
                if (callback)
                    setImmediate(() => {
                        callback();
                        resolveServerStart(12345);
                    });
            });
            mockDomainInstance.run.mockImplementationOnce((callback) => {
                return callback();
            });
            (0, index_1.default)({ title: 'Min' });
            await serverStartPromise;
            await new Promise(resolve => setImmediate(resolve));
            (0, globals_1.expect)(spawn).toHaveBeenCalledWith('powershell.exe', globals_1.expect.any(Array), globals_1.expect.objectContaining({
                cwd: globals_1.expect.any(String),
                shell: true,
                detached: true,
                stdio: 'ignore'
            }));
        });
    });
    (0, globals_1.describe)('TypeScript Interface Validation', () => {
        (0, globals_1.beforeEach)(() => {
            Object.defineProperty(process, 'platform', { value: 'win32', writable: true });
        });
        (0, globals_1.test)('should accept valid WindowsDebuggerOptions interface', () => {
            const validOptions = {
                title: 'Test Title',
                default: 'test-default',
                eval: (cmd) => `evaluated: ${cmd}`
            };
            (0, globals_1.expect)(() => (0, index_1.default)(validOptions)).not.toThrow();
        });
        (0, globals_1.test)('should accept partial WindowsDebuggerOptions interface', () => {
            const partialOptions = {
                title: 'Partial Test'
            };
            (0, globals_1.expect)(() => (0, index_1.default)(partialOptions)).not.toThrow();
        });
    });
});
//# sourceMappingURL=windowsDebugger.test.js.map