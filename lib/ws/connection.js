
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
  
  setup.call(this);

  if(upgradeHead && upgradeHead.length == 8 && server.options.version == "draft76"){
    handshake.call(this);
  } else if (server.options.version == "draft75"){
    handshake.call(this);
  } else {
    this.readyState = 2;
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

// var states = [
//   "unknown",
//   "opening",
//   "waiting",
//   "handshaking",
//   "connected",
//   "closed"
// ];

Connection.prototype.__state__ = 0;

Object.defineProperty(Connection.prototype, "readyState", {
  set: function(state){
    if(typeof state == "number"){
      this.__state__ = state;
      this.emit("readyStateChange", this.__state__);
    } else {
      throw new Error("The value must be a number");
    }
  },
  
  get: function(){
    return this.__state__;
  }
});

/*-----------------------------------------------
  Writing data:
-----------------------------------------------*/
Connection.prototype.write = function(data){
  var socket = this._req.socket;
  if(this.readyState == 4){
    if(socket.readable && socket.writable){
      sys.log(this._id+ ": write: "+data);
      socket.write("\u0000", "binary");
      socket.write(data, "utf8");
      socket.write("\uffff", "binary");
    } else {
      //--this._server.connections;
      sys.log("Client "+this._id+" has no connection.");
      this.readyState = 5;
    }
  }
};

/*-----------------------------------------------
  Setup the various event handlers
-----------------------------------------------*/
function setup(){
  var conn = this;
  
  // Set the connection ID:
  this._id = ++this._server.connections;
  
  // Allow us to send data immediately:
  this._req.socket.setTimeout(0);
  
  // Not sure if this is really needed:
  this._req.socket.setKeepAlive(true, 0);
  
  // Handle incoming data:
  //  - I need to use ondata here, as I need access to
  //    the start, end and raw buffer.
  this._req.socket.ondata = function(data, start, end){
    ondata.call(conn, data, start, end);
  };
  // Emit the new connection:
  this._server.emit("client", conn);
  this._server.clients[conn._id] = conn;
  
  // Listener for the readyStateChange to fire a few events.
  this.addListener("readyStateChange", function(readyState){
    if(readyState == 4){
      conn.emit("open");
    } else if(readyState == 5){
      conn.emit("close");
    }
  });
};

/*-----------------------------------------------
  The new onData callback for 
  http.Server IncomingMessage
-----------------------------------------------*/
function ondata(data, start, end){
  // The readyState will only be 2 if using draft76:
  if(this.readyState == 2){
    // TODO: I need to figure out an alternative here.
    // data.copy(this._req.upgradeHead, 0, start, end);
    handshake.call(this);
  // Assume the data is now a message:
  } else if(this.readyState == 4){
    data = data.slice(start, end);
    this.emit("message", data.toString("utf8", 1, data.length - 1));
  }
};

/*-----------------------------------------------
  Formatters for the urls
-----------------------------------------------*/
function websocket_origin(){
  var origin = this._server.options.origin;
  if(origin == "*" || typeof origin == "Array"){
    origin = this._req.headers.origin;
  }
  return origin;
};

function websocket_location(){
  var location = "",
      secure = this._req.socket.secure,
      request_host = this._req.headers.host.split(":"),
      port = request_host[1];
  
  if(secure){
    location += "wss://";
  } else {
    location += "ws://";
  }
  
  location += request_host[0]
  
  if(!secure && port != 80 || secure && port != 443){
    location += ":"+port;
  }
  
  location += this._req.url;
  
  return location;
};

/*-----------------------------------------------
  Do the handshake.
-----------------------------------------------*/
function handshake(){
  var version = this._server.options.version;
  this.readyState = 3;
  sys.log("handshake");
  
  if(version == "draft75"){
    handshakeWithDraft75.call(this);
  } else if(version == "draft76"){
    handshakeWithDraft76.call(this);
  }
}

/* Using draft75, work out and send the handshake. */
function handshakeWithDraft75(){
  sys.log("handshakeWithDraft75");

  var req = [
    "HTTP/1.1 101 Web Socket Protocol Handshake",
    "Upgrade: WebSocket",
    "Connection: Upgrade",
    "WebSocket-Origin: "+websocket_origin.call(this),
    "WebSocket-Location: "+websocket_location.call(this)
  ].join("\r\n");
  
  if("subprotocol" in this._server.options) {
    req += "\r\nWebSocket-Protocol: "+this._server.options.subprotocol;
  }
  
  req += "\r\n\r\n";
  
  this._req.socket.write(req, "utf8");
  this.readyState = 4;
};

/* Using draft76 (security model), work out and send the handshake. */
function handshakeWithDraft76(){
  
};