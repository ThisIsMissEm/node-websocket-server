

/*-----------------------------------------------
  Requirements:
-----------------------------------------------*/

// System
var sys    = require("sys")
  , http   = require("http")
  , events = require("events")
  , path   = require("path");

// Local
require.paths.unshift(__dirname);

var Manager = require("ws/manager")
  , Connection = require("ws/connection");


/*-----------------------------------------------
  Mixin:
-----------------------------------------------*/
var mixin = function(target, source) {
  for(var i = 0, keys = Object.keys(source), l = keys.length; i < l; ++i) {
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
};

/*-----------------------------------------------
  WebSocket Server Implementation:
-----------------------------------------------*/
function Server(options){
  this.options = mixin({
    version: "auto",// string, either: draft75, draft76, auto
    origin: "*",       // string | array, any valid domain
    subprotocol: null, // string | array
    debug: false
  }, options || {});
  
  
  events.EventEmitter.call(this);

  var ws        = this;
  var server    = this.server = new http.Server();
  this.manager  = new Manager();
  
  server.addListener("upgrade", function(){
    handleUpgradeRequest.apply(ws, arguments);
  });
  
  server.addListener("listening", function(req, res){
    ws.emit("listening");
  });
  
  server.addListener("request", function(req, res){
    ws.emit("request", req, res);
  });
  
  server.addListener("stream", function(stream){
    ws.emit("stream", stream);
  });
  
  server.addListener("close", function(errno){
    ws.emit("close", errno);
  });
  
  server.addListener("clientError", function(e){
    ws.emit("clientError", e);
  });
};

sys.inherits(Server, events.EventEmitter);

Server.prototype.broadcast = function(data){
  this.manager.forEach(function(client){
    client.write(data);
  });
  //for(var cid in this.connections){
  //  this.connections[cid].write(data);
  //}
};

Server.prototype.listen = function(){
  this.server.listen.apply(this.server, arguments);
};

Server.prototype.close = function(){
  this.server.close();
};

/*-----------------------------------------------
  Specific receivers of Events
-----------------------------------------------*/

function handleUpgradeRequest(req, socket, upgradeHead){
  if(req.method == "GET" && "upgrade" in req.headers && "connection" in req.headers &&
     req.headers.upgrade.toLowerCase() == "websocket" && req.headers.connection.toLowerCase() == "upgrade"
  ){
    var conn = new Connection(this, req, socket, upgradeHead);
    this.manager.attach(conn._id, conn);
    this.emit("connection", conn);
    
    //sys.puts(sys.inspect(this.manager, true, 2));
  } else {
    socket.end();
  }
};