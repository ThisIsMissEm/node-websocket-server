var sys = require("sys")
  , http = require("http")
  , fs = require("fs")
  , path = require("path")
  , ws = require('../../lib/ws/server');

var httpServer = http.createServer(function(req, res){
  if(req.method == "GET"){
    if( req.url.indexOf("favicon") > -1 ){
      res.writeHead(200, {'Content-Type': 'image/x-icon', 'Connection': 'close'});
      res.end("");
    } else {
      res.writeHead(200, {'Content-Type': 'text/html', 'Connection': 'close'});
      fs.createReadStream( path.normalize(path.join(__dirname, "client.html")), {
        'flags': 'r',
        'encoding': 'binary',
        'mode': 0666,
        'bufferSize': 4 * 1024
      }).addListener("data", function(chunk){
        res.write(chunk, 'binary');
      }).addListener("end",function() {
        res.end();
      });
    }
  } else {
    res.writeHead(404);
    res.end();
  }
});


var server = ws.createServer({
  server: httpServer
});

server.addListener("listening", function(){
  sys.log("Listening for connections.");
});

// Handle WebSocket Requests
server.addListener("connection", function(conn){
  console.log('[*] open');
  conn.send("** Connected as: user_"+conn.id);
  conn.send("** Type `/nick USERNAME` to change your username");

  conn.broadcast("** "+conn.id+" connected");

  conn.addListener("message", function(message){
    if (message == 'close') {
      console.log('[-] close requested')
      conn.close();
    } else {
      console.log('[+] ', (new Buffer(message)).inspect());
      server.broadcast(conn.id+": "+message);
    }
  });
  
  conn.addListener("close", function(){
    console.log('[*] close');
  })
});

server.addListener("disconnect", function(conn){
  server.broadcast("<"+conn.id+"> disconnected");
});

server.listen(8000);