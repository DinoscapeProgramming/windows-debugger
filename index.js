const net = require("net");
const util = require("util");
const repl = require("repl");
const crypto = require("crypto");
const domain = require("domain");
const childProcess = require("child_process");

const replDomain = domain.create();

module.exports = ({ title = "Windows Debugger", default: defaultValue, eval: evalFunction = eval, password = crypto.randomUUID() } = {}) => replDomain.run(() => {
  console.assert(process.platform === "win32", "This module only works on Windows.");

  const server = net.createServer((socket) => {
    socket.once("data", (data) => {
      if (data.toString().trim() !== password) return socket.destroy();

      repl.start({
        input: socket,
        output: socket,
        terminal: false,
        prompt: "> ",
        eval: (command, _, __, callback) => {
          try {
            callback(null, (command.trim()) ? evalFunction(command) : defaultValue);
          } catch (error) {
            callback(error);
          };
        },
        writer: (output) => util.inspect(output, { colors: true, depth: null })
      });
    });
  });

  server.listen(0, () => {
    childProcess.spawn("powershell.exe", [
      "-NoExit",
      "-Command",
      `$host.UI.RawUI.WindowTitle='${title.replace(/'/g, "''")}'; node -e '${`
        const net = require('net');
        const socket = net.connect(${server.address().port.toString()}, 'localhost');
        socket.write(\`\${process.env.REPL_PASSWORD}\\n\`);
        socket.pipe(process.stdout);
        process.stdin.pipe(socket);
      `.replace(/\n/g, " ").replace(/'/g, "''")}'; exit`
    ], {
      cwd: process.cwd(),
      shell: true,
      detached: true,
      stdio: "ignore",
      env: {
        ...process.env,
        ...{
          REPL_PASSWORD: password
        }
      }
    });
  });
});

replDomain.on("error", () => {});