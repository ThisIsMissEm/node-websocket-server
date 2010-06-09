
var sys = require("sys")
  , events = require("events");

// Debugger:
var LOG = false;

function debug(msg){
  if(LOG) sys.log("<"+this._id+"> "+msg);
};

/*-----------------------------------------------
  The Connection:
-----------------------------------------------*/
module.exports = Connection;

function Connection(server, req, socket, upgradeHead){
  LOG = server.options["debug"] ? !!server.options.debug : false;
  
  this._req = req;
  this._server = server;
  this._upgradeHead = upgradeHead;
  this._id = this._req.socket.remotePort;
  
  this.version = this.getVersion();
  
  if(! checkVersion.call(this)){
    this.reject("Invalid version.");
  } else {
    debug.call(this, this.version+" connection");
    
    setup.call(this);
    
    if((this.version == "draft75") || (this.version == "draft76" && this._upgradeHead && this._upgradeHead.length == 8)){
      handshake.call(this);
    } else {
      this.readyState = 2;
      debug.call(this, "waiting.");
    }
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
  
  if(this.readyState == 4 && socket.writable){
    debug.call(this, "write: "+data);
    
    socket.write("\u0000", "binary");
    socket.write(data, "utf8");
    socket.write("\uffff", "binary");
    return true;
  } else {
    debug.call(this, "ERROR: write: "+data)
    return false;
  }
};

Connection.prototype.close = function(){
  this._req.socket.end();
  this._req.socket.destroy();
  this.readyState = 5;
  debug.call(this, "closed");
};

Connection.prototype.reject = function(reason){
  debug.call(this, "rejected. Reason: "+reason);
  this.emit("rejected");
  this.close();
};


Connection.prototype.getVersion = function(){
  if(this._req.headers["sec-websocket-key1"] && this._req.headers["sec-websocket-key2"]){
    return "draft76";
  } else {
    return "draft75";
  }
};

/*-----------------------------------------------
  Setup the various event handlers
-----------------------------------------------*/
function setup(){
  var conn = this;
  var socket = this._req.socket;
  
  // Invoke the eventEmitter inheritance.
  events.EventEmitter.call(this);
  
  // Allow us to send data immediately:
  socket.setTimeout(0);
  socket.setNoDelay(true);
  // Not sure if this is really needed:
  socket.setKeepAlive(true, 0);
  // Handle incoming data:
  //  - I need to use ondata here, as I need access to
  //    the start, end and raw buffer.
  socket.ondata = function(data, start, end){
    ondata.call(conn, data, start, end);
  };

  conn.addListener("readyStateChange", function(state){
    if(state == 4){
      attachClient.call(conn);
    } else if( state == 5 ){
      detachClient.call(conn);
      conn.emit("close");
    }
  });
  
  socket.addListener("end", function(){
    conn.readyState = 5;
  });
};


function checkVersion(){
  var server_version = this._server.options.version
    , client_version = this.version = this.version || this.getVersion();
    
  if(server_version == "auto" || server_version == client_version){
    return true;
  } else {
    return false;
  }
}

/*-----------------------------------------------
  Attach & Detach the client from the server
-----------------------------------------------*/
function attachClient(){
  var server = this._server;

  // Set the connection ID:
  var client_id = this._id;
  var resource = this._req.url.replace(/^\//, '');
  // A simple hash of all currently connected clients.
  if(!server.connections) server.connections = {};
  // A list of all the routes, which match with a req.pathname
  if(!server.routes) server.routes = {};
  if(!server.routes[resource]) server.routes[resource] = {};
  
  server.connections[client_id] = this;
  server.routes[resource][client_id] = this;
  
  this._server.emit("connection", this);
};

function detachClient(){
  var server = this._server;
  var client_id = this._id;
  var resource = this._req.url.replace(/^\//, '');
  // A simple hash of all currently connected clients.
  if(server.connections)
    server.connections[client_id] = undefined;
    delete server.connections[client_id];
  
  // A list of all the routes, which match with a req.pathname
  if(server.routes && server.routes[resource])
    server.routes[resource][client_id] = undefined;
    delete server.routes[resource][client_id];
};

/*-----------------------------------------------
  The new onData callback for 
  http.Server IncomingMessage
-----------------------------------------------*/
function ondata(data, start, end){
  // The readyState will only be 2 if using draft76:
  if(this.readyState == 2 && this.version == "draft76"){
    // TODO: I need to figure out an alternative here.
    // data.copy(this._req.upgradeHead, 0, start, end);
    handshake.call(this);
  // Assume the data is now a message:
  } else if(this.readyState == 4){
    var flag_begin = data.toString("ascii", start, start+1);
    var flag_end = data.toString("ascii", end-1, end);
    
    if(flag_begin == "\u0000" && flag_end == "\ufffd"){
      if(data.length > 2){
        this.emit("message", data.toString("utf8", start+1, end-1));
      } else {
        this.close();
      }
    } else {
      this.reject("invalid message");
    }
  }
};

/*-----------------------------------------------
  Keep the monkeys for later, if we need them. 
-----------------------------------------------*/
// function monkeyPatchFirstPacket(){
//   this._req.socket.write("\u0000", "binary");
//   this._req.socket.write("", "binary");
//   this._req.socket.write("\ufffd", "binary");
// };

/*-----------------------------------------------
  Formatters for the urls
-----------------------------------------------*/
function websocket_origin(){
  var origin = this._server.options.origin || "*";
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
  this.readyState = 3;
  debug.call(this, this.version+" handshake");
  handshake[this.version].call(this);
}

/* Using draft75, work out and send the handshake. */
handshake.draft75 = function(){
  var req = "HTTP/1.1 101 Web Socket Protocol Handshake\r\n"
          + "Upgrade: WebSocket\r\n"
          + "Connection: Upgrade\r\n"
          + "WebSocket-Origin: "+websocket_origin.call(this)+"\r\n"
          + "WebSocket-Location: "+websocket_location.call(this);
  
  if(this._server.options.subprotocol && typeof this._server.options.subprotocol == "string") {
    req += "\r\nWebSocket-Protocol: "+this._server.options.subprotocol;
  }
  
  this._req.socket.write(req+"\r\n\r\n", "ascii");
  this._req.socket.flush();
  this.readyState = 4;
};

/* Using draft76 (security model), work out and send the handshake. */
handshake.draft76 = function(){
};