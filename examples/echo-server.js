var sys = require("sys");
var ws = require('../lib/ws');

// We're using a custom logged method here:
var logger = require("../utils/logger");

var server = ws.createServer({
  debug: true,
  version: "auto"
});

server.addListener("listening", function(){
  sys.log("Listening for connections.");
});

// Handle WebSocket Requests
server.addListener("connection", function(conn){
  function log(data){
    sys.puts((+new Date())+" \033[0;32m<"+conn._id+"> "+data.toString()+"\033[0m");
  };
  
  log("connected");
  server.broadcast("<"+conn._id+"> connected");
  
  conn.addListener("close", function(){
    log("onClose");
    server.broadcast("<"+conn._id+"> disconnected");
  });
  
  conn.addListener("message", function(message){
    log([message.length, JSON.stringify(message)].join(" | "));
    server.broadcast("<"+conn._id+"> "+message);
  });
});

// Handle HTTP Requests:
server.addListener("request", function(req, res){
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('This is, infact a websocket server, but we can do http!\n');
});

server.listen(8000, "localhost");
