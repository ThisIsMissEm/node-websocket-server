var sys = require("sys");
var ws = require('../lib/ws');

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


/*-----------------------------------------------
  Spin up our server:
-----------------------------------------------*/
var server = ws.createServer({
  debug: true
});

server.addListener("listening", function(){
  log("Listening for connections.");
});

// Handle WebSocket Requests
server.addListener("connection", function(conn){
  log("opened connection: "+conn._id);
  
  server.send(conn._id, "Connected as: "+conn._id);
  server.broadcast("<"+conn._id+"> connected");
  
  conn.addListener("message", function(message){
    log("<"+conn._id+"> "+message);
    server.broadcast("<"+conn._id+"> "+message);
  });
});

server.addListener("close", function(conn){
  log("closed connection: "+conn._id);
  server.broadcast("<"+conn._id+"> disconnected");
});

// Handle HTTP Requests:
server.addListener("request", function(req, res){
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('We can handle normal http connections too!\n');
});

server.addListener("shutdown", function(conn){
  // never actually happens, because I never tell the server to shutdown.
  log("Server shutdown");
});


server.listen(8000, "localhost");
