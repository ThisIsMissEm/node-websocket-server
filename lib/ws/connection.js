var debug = function(){}
  , util = require("util")
  , events = require("events")
  , _events = require("../_events")
  , Crypto = require("crypto")
  , Parser = require("./parser");

(Connection = function(manager, options, req, socket, upgradeHead){
  var _firstFrame, connection = this;

  this._req = req;
  this._socket = socket;
  this._manager = manager;
  this.id = manager.createId(socket.remotePort);

  options.version = options.version || "auto";
  options.origin = options.origin || "*";
  options.subprotocol = options.subprotocol || "*";
  options.debug = options.debug || false;
  this._options = options;

  if(connection._options.debug) {
    debug = function () { util.debug('\033[90mWS: ' + Array.prototype.join.call(arguments, ", ") + "\033[39m"); };
  }

  Object.defineProperties(this, {
    version: {
      get: function(){
        return req.headers["sec-websocket-key1"] && req.headers["sec-websocket-key2"] ? "draft76" : "draft75";
      }
    }
  });

  // Set the initial connecting state.
  connection.state(1);
  // Setup the connection manager's state change listeners:
  connection.on("stateChange", function(state, laststate){
    if(state === 4) {
      manager.attach(connection);
      // Handle first frame breakages.
      if(_firstFrame){
        parser.write(_firstFrame);
        delete _firstFrame;
      }
    } else if(state === 5) {
      close(connection);
    } else if(state === 6 && laststate === 5) {
      manager.detach(connection);
      connection.emit("close");
    }
  });


  // Start to process the connection
  if( !checkVersion(this)) {
    this.reject("Invalid version.");
  } else {
    // Let the debug mode know that we have a connection:
    debug(this.id, this.version+" connection");
    
    socket.setTimeout(0);
    socket.setNoDelay(true);
    socket.setKeepAlive(true, 0);

    // Handle incoming data:
    var parser = new Parser(this);

    parser.on("message", function(message){
      debug(connection.id, "recv: " + message);
      connection.emit("message", message);
    });

    socket.on("data", function(data){
      parser.write(data);
    });
    socket.on("end", function(){
      debug(connection.id, "end");
      connection.state(5);
    });
    socket.on('timeout', function () {
      debug(connection.id, "timed out");
      connection.emit("timeout");
    });
    socket.on("error", function(e){
      debug(connection.id, "error", e);
      if(e.errno != 32) connection.emit("error", e);
      connection.state(5);
    });

    // Bubble errors up to the manager.
    connection.bubbleEvent("error", manager);

    // Carry out the handshaking.
    //    - Draft75: There's no upgradeHead, goto Then.
    //      Draft76: If there's an upgradeHead of the right length, goto Then.
    //      Then: carry out the handshake.
    //
    //    - Currently no browsers to my knowledge split the upgradeHead off the request,
    //      but in the case it does happen, then the state is set to waiting for
    //      the upgradeHead.
    //
    // This switch is sorted in order of probably of occurence.
    switch(this.version) {
      case "draft76":
        if(upgradeHead.length >= 8) {
          if(upgradeHead.length > 8) _firstFrame = upgradeHead.slice(8, upgradeHead.length);
          handshakes.draft76(connection, upgradeHead.slice(0, 8));
        } else {
          connection.reject("Missing key3");
        }
        break;
      case "draft75":
        handshakes.draft75(connection);
        break;
      default:
        connection.reject("Unknown version: "+this.version);
        break;
    }
  }
})
.prototype = {
  __proto__: _events.EventEmitter.prototype, _state: 0,
  state: function(state) {
    if(state === undefined || typeof state !== "number") return;
    var oldstate = this._state;
    this._state = state;
    this.emit("stateChange", this._state, oldstate);
  },
  inspect: function() {
    return "<WS:Connection "+this.id+">";
  },
  write: function(data) {
    if(this._state === 4) {
      debug(this.id, "write: "+data);
      if(
        write(this, "\x00", "binary") &&
        write(this, data, "utf8") &&
        write(this, "\xff", "binary")
      ) {
        return true;
      } else {
        debug(this.id, "\033[31mERROR: write: "+data);
      }
    } else {
      debug(this.id, "\033[31mCouldn't send.");
    }
    return false;
  },
  send: function(d) { this.write(d) },
  broadcast: function(data){
    this._manager.forEach(function(client){
      if(client && client._state === 4 && client.id != this.id) client.write(data);
    }, this);
  },
  close: function(){
    if(this._state == 4 && this._socket.writable) {
      write(this, "\xff", "binary");
      write(this, "\x00", "binary");
    }
    this.state(5);
  },
  reject: function(reason){
    debug(this.id, "rejected. Reason: "+reason);
    this.state(5);
  },
  handshake: function(){
    if(this._state < 3){
      debug(this.id, this.version+" handshake");
      this.state(3);
      doHandshake[this.version].call(this);
    } else {
      debug(this.id, "Already handshaked.");
    }
  }
};

module.exports = Connection;


/*-----------------------------------------------
  Do the handshake.
-----------------------------------------------*/
var handshakes = {
  // Using draft75, work out and send the handshake.
  draft75: function(connection){
    connection.state(3);

    var location = websocket_location(connection)
      , res;

    if(location){
      res = "HTTP/1.1 101 Web Socket Protocol Handshake\r\n"
          + "Upgrade: WebSocket\r\n"
          + "Connection: Upgrade\r\n"
          + "WebSocket-Origin: "+websocket_origin(connection)+"\r\n"
          + "WebSocket-Location: "+location;

      if(connection._options.subprotocol && typeof connection._options.subprotocol == "string") {
        res += "\r\nWebSocket-Protocol: "+connection._options.subprotocol;
      }

      write(connection, res+"\r\n\r\n", "ascii");

      connection.state(4);
    }
  },

  // Using draft76 (security model), work out and send the handshake.
  draft76: function(connection, upgradeHead){
    connection.state(3);

    var location = websocket_location(connection)
      , res;

    if(location){
      res = "HTTP/1.1 101 WebSocket Protocol Handshake\r\n"
          + "Upgrade: WebSocket\r\n"
          + "Connection: Upgrade\r\n"
          + "Sec-WebSocket-Origin: "+websocket_origin(connection)+"\r\n"
          + "Sec-WebSocket-Location: "+location;

      if(connection._options.subprotocol && typeof connection._options.subprotocol == "string") {
        res += "\r\nSec-WebSocket-Protocol: "+connection._options.subprotocol;
      }

      var strkey1 = connection._req.headers['sec-websocket-key1']
        , strkey2 = connection._req.headers['sec-websocket-key2']

        , numkey1 = parseInt(strkey1.replace(/[^\d]/g, ""), 10)
        , numkey2 = parseInt(strkey2.replace(/[^\d]/g, ""), 10)

        , spaces1 = strkey1.replace(/[^\ ]/g, "").length
        , spaces2 = strkey2.replace(/[^\ ]/g, "").length;


      if (spaces1 == 0 || spaces2 == 0 || numkey1 % spaces1 != 0 || numkey2 % spaces2 != 0) {
        connection.reject("WebSocket contained an invalid key -- closing connection.");
      } else {
        var hash = Crypto.createHash("md5")
          , key1 = pack(parseInt(numkey1/spaces1))
          , key2 = pack(parseInt(numkey2/spaces2));

        hash.update(key1);
        hash.update(key2);
        hash.update(upgradeHead.toString("binary"));

        res += "\r\n\r\n";
        res += hash.digest("binary");

        write(connection, res, "binary");

        connection.state(4);
      }
    }
  }
};

/*-----------------------------------------------
Various utility style functions:
-----------------------------------------------*/
var write = function(connection, data, encoding) {
  if(connection._socket.writable){
    try {
      connection._socket.write(data, encoding);
      return true;
    } catch(e){ debug(null, "Error on write: "+e.toString()); }
  }
  return false;
};
function close(connection) {
  connection._socket.flush();
  connection._socket.end();
  connection._socket.destroy();
  debug(connection.id, "socket closed");
  connection.state(6);
};
function checkVersion(connection) {
  var server_version = connection._options.version.toLowerCase();
  return (server_version == "auto" || server_version == connection.version);
};
function pack(num) {
  return String.fromCharCode(num >> 24 & 0xFF)
  + String.fromCharCode(num >> 16 & 0xFF)
  + String.fromCharCode(num >> 8 & 0xFF)
  + String.fromCharCode(num & 0xFF);
};


/*-----------------------------------------------
Formatters for the urls
-----------------------------------------------*/
//TODO: Properly handle origin headers.
function websocket_origin(connection) {
  var origin = connection._options.origin || "*";
  if(origin == "*" || Array.isArray(origin)) {
    origin = connection._req.headers.origin;
  }
  return origin;
};

function websocket_location(connection){
  if(connection._req.headers["host"] === undefined){
    connection.reject("Missing host header");
    return;
  } 
  var location = ""
    , secure = connection._socket.secure
    , host = connection._req.headers.host.split(":")
    , port = host[1] !== undefined ? host[1] : (secure ? 443 : 80);
  
  location += secure ? "wss://" : "ws://";
  location += host[0];
  
  if(!secure && port != 80 || secure && port != 443){
    location += ":"+port;
  } 
  location += connection._req.url;
  return location;
};