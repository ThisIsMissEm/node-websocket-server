var sys = require("sys");
var ws = require('./lib/ws');

// We're using a custom logged method here:
var logger = require("./utils/logger");
function log(data){
  sys.log("\033[0;32m"+data.toString()+"\033[0m");
};

var server = ws.createServer();
server.listen(8000);

server.addListener("listening", function(){
  log("Listening for connections.");
});

function braodcast(server, conn, data){
  for(var cid in server.connections){
    server.connections[cid].write("<"+conn._id+"> "+data);
  }
};

server.addListener("connection", function(conn){
  log("<"+conn._id+"> connected");
  braodcast(server, conn, "connected");
  
  conn.addListener("close", function(){
    log("<"+conn._id+"> onClose");
    braodcast(server, conn, "disconnected");
  });

  conn.addListener("message", function(message){
    log("<"+conn._id + "> "+message);
    braodcast(server, conn, message);
  });
});

server.addListener("request", function(req, res){
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('This is, infact a websocket server, but we can do http!\n');
});
