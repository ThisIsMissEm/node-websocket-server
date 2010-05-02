var sys = require("sys");
var ws = require('./lib/ws');

function log(data){
  sys.log("\033[0;32m"+data+"\033[0m");
}

var server = ws.createServer();

server.listen(7000);

server.addListener("readyStateChange", function(readyState){
  log("stateChanged: "+readyState);
});

server.addListener("client", function(conn){
  log(conn._id + ": new connection");
  
  conn.addListener("open", function(){
    log(conn._id + ": onOpen");
  });
  
  conn.addListener("message", function(message){
    log(conn._id + ": "+JSON.stringify(message));
    
    server.clients.forEach(function(client){
      client.write(conn._id + ": "+message);
    });
  });
});