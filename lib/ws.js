

/*-----------------------------------------------
  Requirements:
-----------------------------------------------*/

// System
var sys    = require("sys"),
    http   = require("http"),
    events = require("events"),
    path   = require("path");

// Local Path
require.paths.unshift(__dirname);
var Connection = require("ws/connection");

/*-----------------------------------------------
  Mixin:
-----------------------------------------------*/
var mixin = function(target, source) {
  var keys = Object.keys(source);
  var length = keys.length;
  for (var i = 0; i < length; i++) {
    var key = keys[i];
    target[key] = source[key];
  }
  return target;
};

/*-----------------------------------------------
  WebSocket Server Exports:
-----------------------------------------------*/
exports.Server = Server;
exports.createServer = function(options){
  return new Server(options || {});
}

/*-----------------------------------------------
  WebSocket Server Implementation:
-----------------------------------------------*/
function Server(options){
  events.EventEmitter.call(this);
  var ws = this;
  
  this.server = new http.Server();
    
  this.options = mixin({
    version: "draft75",//"draft75",    // string, [spec, draft75]
    origin: "*",        // string | array, any valid domain
    subprotocol: null   // string | array
  }, options || {});
  
  this.count = 0;
  
  this.server.addListener("listening", function(){
    ws.emit("listening");
  });
  
  this.server.addListener("upgrade", function(){
    handleUpgradeRequest.apply(ws, arguments);
  });
};

sys.inherits(Server, events.EventEmitter);

Server.prototype.broadcast = function(data){
  throw new Error("WebSocketServer.broadcast is not yet implemented.");
};

Server.prototype.listen = function(){
  this.server.listen.apply(this.server, arguments);
};

Server.prototype.destroy = function(){
  throw new Error("WebSocketServer.destroy is not yet implemented.");
};

Server.prototype.end = function(){
  throw new Error("WebSocketServer.end is not yet implemented.");
};

/*-----------------------------------------------
  Specific receivers of Events
-----------------------------------------------*/

function handleUpgradeRequest(req, socket, upgradeHead){
  if(req.method == "GET" && "upgrade" in req.headers && "connection" in req.headers &&
     req.headers.upgrade.toLowerCase() == "websocket" && req.headers.connection.toLowerCase() == "upgrade"
  ){
    new Connection(this, req, socket, upgradeHead);
  } else {
    socket.end();
  }
};