var sys = require("sys");
var ws = require('./lib/ws');

function log(data){
  sys.log("\033[0;32m"+data+"\033[0m");
}

var server = ws.createServer();

server.listen(7000);

server.addListener("client", function(conn){
  log("new connection");
  conn.addListener("message", function(message){
    log(JSON.stringify(message));
  })
})