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

server.addListener("connection", function(conn){
  log("<"+conn._id+"> new connection");
  conn.write(logger.timestamp()+" new connection");
  
  conn.addListener("close", function(){
    log("<"+conn._id+"> onClose");
  });

  conn.addListener("message", function(message){
    log("<"+conn._id + "> "+message);
    conn.write(logger.timestamp()+" "+message);
  });
});
