var sys = require("sys");
var ws = require('../lib/ws');

// We're using a custom logged method here:
var logger = require("../utils/logger");
function log(data){
  sys.log("\033[0;32m"+data.toString()+"\033[0m");
};

var server = ws.createServer();
server.listen(8000);

server.addListener("listening", function(){
  log("Listening for connections.");
});

// Handle WebSocket Requests
server.addListener("connection", function(conn){
  log("<"+conn._id+"> connected");
  server.broadcast("<"+conn._id+"> connected");
  
  conn.addListener("close", function(){
    log("<"+conn._id+"> onClose");
    server.broadcast("<"+conn._id+"> disconnected");
  });

  conn.addListener("message", function(message){
    log("<"+conn._id + "> "+message);
    server.broadcast("<"+conn._id+"> "+message);
  });
});

// Handle HTTP Requests:
server.addListener("request", function(req, res){
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('This is, infact a websocket server, but we can do http!\n');
});
