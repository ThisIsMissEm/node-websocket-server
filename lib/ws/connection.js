
var sys = require("sys"),
    events = require("events");


module.exports = Connection;

/*-----------------------------------------------
  The Connection:
-----------------------------------------------*/
function Connection(server, req, socket, upgradeHead){
  sys.log("new connection: using "+(server.options.version));
  events.EventEmitter.call(this);
  
  this._req = req;
  this._server = server;
  this._state = 1;
  
  this.setup();

  if(upgradeHead && upgradeHead.length == 8 && server.options.version == "draft76"){
    handshake.call(this);
  } else if (server.options.version == "draft75"){
    handshake.call(this);
  } else {
    this._state = 2;
    sys.log("waiting.");
  }
};

sys.inherits(Connection, events.EventEmitter);

/*-----------------------------------------------
  0. unknown
  1. opening
  2. waiting
  3. handshaking
  4, connected
  5. closed
-----------------------------------------------*/
Connection.prototype._state = 0;


/*-----------------------------------------------
  Setup the various event handlers
-----------------------------------------------*/
Connection.prototype.setup = function(){
  var conn = this;
  
  this._req.socket.ondata = function(data, start, end){
    ondata.call(conn, data, start, end);
  };
};

/*-----------------------------------------------
  The new onData callback for 
  http.Server IncomingMessage
-----------------------------------------------*/
function ondata(data, start, end){
  //sys.log("recv: '"+ data.toString("utf8")+"'");
  if(this._state == 2){
    
    //data.copy(this._req.upgradeHead, 0, start, end);
    handshake.call(this);
  } else if(this._state == 4){
    data = data.slice(start, end);
    this.emit("message", data.toString("utf8", 1, data.length - 1));
  }
};

/*-----------------------------------------------
  Formatters for the urls
-----------------------------------------------*/
function websocket_origin(req, server){
  var origin = server.options.origin;
  if(server.options.origin == "*" || typeof server.options.origin == "Array"){
    origin = req.headers.origin;
  }
  return origin;
};

function websocket_location(req, server){
  return [
    req.socket.secure ? "wss://" : "ws://",
    req.headers.host.split(":")[0],
    (!req.socket.secure && server.connection.port != 80 || req.socket.secure && server.connection.port != 443) ? ":"+server.connection.port : "",
    req.url
  ].join('');
};

/*-----------------------------------------------
  Do the handshake.
-----------------------------------------------*/
function handshake(){
  this._state = 3;
  
  sys.log("handshake");
  
  if(this._server.options.version == "draft75"){
    handshakeWithDraft75.call(this);
  } else if(this._server.options.version == "draft76"){
    handshakeWithDraft76.call(this);
  }
}

/* Using draft75, work out and send the handshake. */
function handshakeWithDraft75(){
  sys.log("handshakeWithDraft75");
  
  var origin = websocket_origin(this._req, this._server);
  sys.log(origin);
  
  var location = websocket_location(this._req, this._server);
  sys.log("location: "+location);
  
  this._req.socket.write([
    "HTTP/1.1 101 Web Socket Protocol Handshake",
    "Upgrade: WebSocket",
    "Connection: Upgrade",
    "WebSocket-Origin: "+origin,
    "WebSocket-Location: "+location,
  //  "WebSocket-Protocol: sample",
    "\r\n"
  ].join("\r\n"), "utf8");
  
  this._state = 4;
};

/* Using draft76 (security model), work out and send the handshake. */
function handshakeWithDraft76(){
  
};