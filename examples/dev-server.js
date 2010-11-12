var sys = require("sys")
  , fs = require("fs")
  , Path = require("path")
  , http = require("http")
  , crypto = require("crypto")
  , ws = require('../lib/ws/server');

console.log(process.pid);

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

var cache = {};
function readPage(path, callback){
  if(cache[path]) {
    callback(cache[path]);
  } else {
    cache[path] = [];
    
    fs.createReadStream( Path.normalize(Path.join(__dirname, path)), {
      'flags': 'r',
      'encoding': 'binary',
      'mode': 0666,
      'bufferSize': 4 * 1024
    }).addListener("data", function(chunk){
      cache[path].push(chunk);
    }).on("end", function(){
      callback(cache[path]);
    });
  }
}

readPage("client.html", function(){});

var reqnum = 0;
function serveFile(req, res){
  if(req.method == "GET"){
    if( req.url.indexOf("favicon") > -1 ){
      log("HTTP: inbound request, served nothing, (favicon)");

      res.writeHead(200, {'Content-Type': 'image/x-icon'});
      res.end("");
    } else {
      log("HTTP: inbound request, served client.html");
      res.writeHead(200, {'Content-Type': 'text/html', 'Connection': 'close'});
      readPage("client.html", function(data){
        data.forEach(function(datum){
          res.write(datum);
        });
        
        res.end();
      });
    }
  } else {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end();
  }
};

/*-----------------------------------------------
  Spin up our server:
-----------------------------------------------*/

var certPem = fs.readFileSync(Path.normalize(Path.join(__dirname, "ssl/cert.pem")), 'ascii');
var keyPem =  fs.readFileSync(Path.normalize(Path.join(__dirname, "ssl/cert.key")), 'ascii');

var credentials = crypto.createCredentials({key:keyPem, cert:certPem});


var httpServer = http.createServer(serveFile);


var server = ws.createServer({
  debug: true,
  useStorage: true,
  server: httpServer
});
server.setSecure(credentials);


server.addListener("listening", function(){
  log("Listening for connections.");
});

// Handle WebSocket Requests
server.addListener("connection", function(conn){
  conn.send("Connection: "+conn.id);
  conn.broadcast("<"+conn.id+"> connected");
  conn.addListener("message", function(message){
    conn.broadcast("<"+conn.id+"> "+message);
//    conn.storage.incr("messages");
  });
});

server.addListener("close", function(conn){
//  sys.puts(conn.id+" sent "+conn.storage.get("messages"));
  server.broadcast("<"+conn.id+"> disconnected");
});

server.listen(8000);