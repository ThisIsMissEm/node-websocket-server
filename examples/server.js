//var ws = require("websocket-server");
var sys = require("sys")
  , ws = require('../lib/ws');

var server = ws.createServer();

server.addListener("connection", function(connection){
  connection.addListener("message", function(msg){
server.broadcast(msg);
  });
});

server.listen(8080);