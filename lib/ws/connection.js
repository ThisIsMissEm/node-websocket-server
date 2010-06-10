
var sys = require("sys")
  , events = require("events")
  , Buffer = require("buffer").Buffer
  , Crypto = require("crypto");

// Debugger:
var DEBUG = false;

function debug(msg){
  if(DEBUG) sys.log("<"+this._id+"> "+msg);
};

/*-----------------------------------------------
  The Connection:
-----------------------------------------------*/
module.exports = Connection;

function Connection(server, req, socket, upgradeHead){
  DEBUG = server.options["debug"] ? !!server.options.debug : false;
  
  this._req = req;
  this._server = server;
  this._upgradeHead = upgradeHead;
  this._id = this._req.socket.remotePort;
  
  this.version = this.getVersion();
  
  if( !checkVersion.call(this)) {
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
      var oldstate = this.__state__;
      this.__state__ = state;
      this.emit("readyStateChange", this.__state__, oldstate);
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

function closeSocket(){
  this._req.socket.end();
  this._req.socket.destroy();
  this.readyState = 5;
  debug.call(this, "closed");
};

Connection.prototype.close = function(){
  var socket = this._req.socket;
  
  if(this.readyState == 4 && socket.writable){
    socket.write("\u0000", "binary");
    socket.write("\uffff", "binary");
  }
  closeSocket.call(this);
};

Connection.prototype.reject = function(reason){
  debug.call(this, "rejected. Reason: "+reason);
  this.emit("rejected");
  closeSocket.call(this);
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
  var parser = new Parser(this);
  socket.addListener("data", function(data){
    parser.write(data);
  });

  conn.addListener("readyStateChange", function(state, oldstate){
    if(state == 4){
      attachClient.call(conn);
    // only detach the client if we were connected and are now not.
    } else if( state == 5 && oldstate == 4){
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
var Parser = function(client){
  this.frameData = [];
  this.order = 0;
  this.client = client;
};

Parser.prototype.write = function(data){
  var pkt;
  for(var i = 0, len = data.length; i<len; i++){
    if(this.order == 0){
      if(data[i] & 0x80 == 0x80){
        this.order = 1;
      } else {
        this.order = -1;
      }
    } else if(this.order == -1){
      if(data[i] === 0xFF){
        pkt = new Buffer(this.frameData);
        this.order = 0;
        this.frameData = [];
        
        this.client.emit("message", pkt.toString("utf8", 0, pkt.length));
      } else {
        this.frameData.push(data[i]);
      }
    } else if(this.order == 1){
      debug.call(this.client, "High Order packet handling is not yet implemented.");
      this.order = 0;
    }
  }
};

/*
function ondata(data, start, end){
  if(this.readyState == 2 && this.version == "draft76"){
    // TODO: I need to figure out an alternative here.
    // data.copy(this._req.upgradeHead, 0, start, end);
    debug.call(this, "Using draft76 & upgrade body not sent with request.");
    this.reject("missing upgrade body");
  // Assume the data is now a message:
  } else if(this.readyState == 4){
    data = data.slice(start, end);
    
    var frame_type = null, length, b;
    var parser_offset = -1;
    var raw_data = [];
    
    while(parser_offset < data.length-2){
      frame_type = data[parser_offset++];
      
      if(frame_type & 0x80 == 0x80){
        debug.call(this, "high");
        b = null;
        length = 1;
        while(length--){
          b = data[parser_offset++];
          length = length * 128 + (b & 0x7F);
          if(b & 0x80 == 0){
            break;
          }
        }
        parser_offset += length;
        if(frame_type == 0xFF && length == 0){
          this.close();
        }
      } else {
        raw_data = [];
        
        while(parser_offset <= data.length){
          b = data[parser_offset++];
          if(b == 0xFF){
            var buf = new Buffer(raw_data);
            this.emit("message", buf.toString("utf8", 0, buf.length));
            break;
          }
          raw_data.push(b);
        }
      }
    }
  }
};
*/


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
};

/* Using draft75, work out and send the handshake. */
handshake.draft75 = function(){
  var res = "HTTP/1.1 101 Web Socket Protocol Handshake\r\n"
          + "Upgrade: WebSocket\r\n"
          + "Connection: Upgrade\r\n"
          + "WebSocket-Origin: "+websocket_origin.call(this)+"\r\n"
          + "WebSocket-Location: "+websocket_location.call(this);
  
  if(this._server.options.subprotocol && typeof this._server.options.subprotocol == "string") {
    res += "\r\nWebSocket-Protocol: "+this._server.options.subprotocol;
  }
  
  this._req.socket.write(res+"\r\n\r\n", "ascii");
  this._req.socket.flush();
  this.readyState = 4;
};

/* Using draft76 (security model), work out and send the handshake. */
function pack(num) {
  var result = '';
  result += String.fromCharCode(num >> 24 & 0xFF);
  result += String.fromCharCode(num >> 16 & 0xFF);
  result += String.fromCharCode(num >> 8 & 0xFF);
  result += String.fromCharCode(num &	0xFF);
  return result;
};

handshake.draft76 = function(){
  var data = "HTTP/1.1 101 WebSocket Protocol Handshake\r\n"
          + "Upgrade: WebSocket\r\n"
          + "Connection: Upgrade\r\n"
          + "Sec-WebSocket-Origin: "+websocket_origin.call(this)+"\r\n"
          + "Sec-WebSocket-Location: "+websocket_location.call(this);
  
  if(this._server.options.subprotocol && typeof this._server.options.subprotocol == "string") {
    res += "\r\nSec-WebSocket-Protocol: "+this._server.options.subprotocol;
  }

  var strkey1 = this._req.headers['sec-websocket-key1']
    , strkey2 = this._req.headers['sec-websocket-key2'];

  var numkey1 = parseInt(strkey1.replace(/[^\d]/g, ""), 10)
    , numkey2 = parseInt(strkey2.replace(/[^\d]/g, ""), 10);

  var spaces1 = strkey1.replace(/[^\ ]/g, "").length
    , spaces2 = strkey2.replace(/[^\ ]/g, "").length;

  if (spaces1 == 0 || spaces2 == 0 || numkey1 % spaces1 != 0 || numkey2 % spaces2 != 0) {
    this.reject("WebSocket contained an invalid key -- closing connection.");
  } else {
    var key1 = pack(parseInt(numkey1/spaces1))
      , key2 = pack(parseInt(numkey2/spaces2));

    var hash = Crypto.createHash("md5");
    hash.update(key1);
    hash.update(key2);
    hash.update(this._upgradeHead.toString("binary"));

    data += "\r\n\r\n";
    data += hash.digest("binary");

    this._req.socket.write(data, "binary");
    this._req.socket.flush();
    this.readyState = 4;
  }
};