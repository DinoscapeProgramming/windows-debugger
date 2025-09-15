const net = require("net");
const repl = require("repl");
const domain = require("domain");
const childProcess = require("child_process");

const replDomain = domain.create();

module.exports = ({ title, default: defaultValue }) => replDomain.run(() => {
  console.assert(process.platform === "win32", "This module only works on Windows.");

  const server = net.createServer((socket) => {
    repl.start({
      input: socket,
      output: socket,
      terminal: false,
      prompt: "> ",
      eval: (command, _, __, callback) => {
        try {
          callback(null, (command.trim()) ? eval(command) : defaultValue);
        } catch (error) {
          callback(error);
        };
      },
      writer: (output) => util.inspect(output, { colors: true, depth: null })
    });
  });

  server.listen(0, () => {
    childProcess.spawn("powershell.exe", [
      "-NoExit",
      "-Command",
      `$host.UI.RawUI.WindowTitle='LocalBotify Debugger - ${title.replace(/'/g, "''")}'; node -e '${`
        const net = require('net');
        const socket = net.connect(${server.address().port.toString()}, 'localhost');
        socket.pipe(process.stdout);
        process.stdin.pipe(socket);
      `.replace(/\n/g, " ").replace(/'/g, "''")}'; exit`
    ], {
      cwd: process.cwd(),
      shell: true,
      detached: true,
      stdio: "ignore"
    });
  });
});

replDomain.on("error", () => {});