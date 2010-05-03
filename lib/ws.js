

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
  http.Server.call(this);
    
  this.options = mixin({
    version: "draft75",//"draft75",    // string, [spec, draft75]
    origin: "*",        // string | array, any valid domain
    subprotocol: null   // string | array
  }, options || {});
  
  this.connections = 0;
  this.connection = {};
  this.clients = [];
  
  this.addListener("listening", getAddressInfo);
  this.addListener("upgrade", handleUpgradeRequest);
};

sys.inherits(Server, http.Server);

/*-----------------------------------------------
  Specific receivers of Events
-----------------------------------------------*/
function getAddressInfo(){
  var tmp = this.address();
  this.connection["host"] = tmp.address;
  this.connection["port"] = tmp.port;
  
  sys.log("Listening for connections.");
};

function handleUpgradeRequest(req, socket, upgradeHead){
  if(req.method == "GET" && "upgrade" in req.headers && "connection" in req.headers &&
     req.headers.upgrade.toLowerCase() == "websocket" && req.headers.connection.toLowerCase() == "upgrade"
  ){
    var conn = new Connection(this, req, socket, upgradeHead);
  } else {
    socket.end();
  }
};