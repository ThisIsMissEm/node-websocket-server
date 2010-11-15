var fs = require("fs")
  , cp = require("child_process")
  , cwd = process.cwd;

cp.exec("git describe", function(err, stdout, stderr) {
  fs.writeFile("package.json", JSON.stringify({ 
    version: stdout.match(/v([0-9]+\.[0-9]+\.[0-9]+)/)[1],
    description: "A WebSocket Server for node.js, 90-100% spec compatible.",
    repository: {
      type: "git",
      url: "http://github.com/miksago/node-websocket-server.git"
    },
    directories: {
      doc: "./doc",
      lib: "./lib/ws"
    },
    main: "./lib/ws/server",
    bugs: {
      web: "http://github.com/miksago/node-websocket-server/issues"
    },
    author: "Micheil Smith <micheil@brandedcode.com>",
    licenses: [
      {
        type: "MIT",
        url: "./LICENSE.md"
      }
    ],
    name: "websocket-server",
    engines: {
      node: ">=0.2.0-0"
    }
  }));
});