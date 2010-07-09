var sys = require("sys")
  , fs = require("fs")
  , path = require("path")
  , http = require("http")
  , ws = require('../lib/ws');

/*-----------------------------------------------
  logging:
-----------------------------------------------*/
var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}

function timestamp() {
  var d = new Date();
  return [
    d.getDate(),
    months[d.getMonth()],
    [ pad(d.getHours())
    , pad(d.getMinutes())
    , pad(d.getSeconds())
    , (d.getTime() + "").substr( - 4, 4)
    ].join(':')
  ].join(' ');
};

function log(msg) {
  sys.puts(timestamp() + ' - ' + msg.toString());
};

function serveFile(req, res){
  if( req.url.indexOf("favicon") > -1 ){
    log("HTTP: "+req.socket.remotePort+", inbound request, served nothing, (favicon)");
    
    res.writeHead(200, {'Content-Type': 'image/x-icon', 'Connection': 'close', 'Content-Length': '0'});
    res.end("");
  } else {
    log("HTTP: "+req.socket.remotePort+", inbound request, served client.html");
    
    res.writeHead(200, {'Content-Type': 'text/html'});
    fs.createReadStream( path.normalize(path.join(__dirname, "client.html")), {
      'flags': 'r',
      'encoding': 'binary',
      'mode': 0666,
      'bufferSize': 4 * 1024
    }).addListener("data", function(chunk){
      res.write(chunk, 'binary');
    }).addListener("close",function() {
      res.end();
    });
  }
};

/*-----------------------------------------------
  Spin up our server:
-----------------------------------------------*/
var httpServer = http.createServer(serveFile);
var connections = 0;

var server = ws.createServer({
  debug: true
}, httpServer);

server.addListener("listening", function(){
  log("Listening for connections.");
});

// Handle WebSocket Requests
server.addListener("connection", function(conn){
//  log("opened connection: "+conn.id);
  
//  server.manager.metadata(conn.id, "messages", 0);
  log(connections++);
//  server.send(conn.id, "Connected as: "+conn.id);
//  conn.broadcast("<"+conn.id+"> connected");
  
  conn.addListener("message", function(message){
//    log("<"+conn.id+"> "+message);
    server.broadcast("<"+conn.id+"> "+message);
  });
  
  // var timer = setInterval(function(){
  //   if(conn._state != 4){
  //     clearInterval(timer); 
  //   } else {
  //     conn.write("You have sent: "+server.manager.metadata(conn.id, "messages")+" messages");
  //   }
  // }, 1000);
});

server.addListener("close", function(conn){
//  log("closed connection: "+conn.id);
//  conn.broadcast("<"+conn.id+"> disconnected");
});

server.listen(8000);
// Handle HTTP Requests:

// This will hijack the http server, if the httpserver doesn't 
// already respond to http.Server#request

// server.addListener("request", serveFile);
