
// System
var sys =    require("sys"),
    http =    require("http"),
    events = require("events"),
    path =   require("path");


require.paths.unshift(path.join(__dirname, "ws"));
require.paths.unshift(__dirname);

// Local
var Connection = require('ws/connection'),
    Utils = require('ws/utilities');

exports.Server = Server;
exports.createServer = function(){
  return new Server();
}

function Server(handler){
  http.Server.call(this);
  
  this.connection = {};
  this.clients = [];
  
  if(handler){
    this.noHandler = handler;
  }
  
  this.addListener("listening", this.handleConnection);
  this.addListener("request",   this.handleRequest);
};

sys.inherits(Server, http.Server);

Server.prototype.handleConnection = function(){
  var tmp = this.address();
  this.connection["address"] = tmp.address;
  this.connection["port"] = tmp.port;
};

Server.prototype.handleRequest = function(req, res){
  if(req.upgrade && res === null){
    this.dispatch_ws(req);
  } else {
    this.noHandler(req, res);
  }
};

Server.prototype.noHandler = function(req, res){
  res.writeHead("501", {
    "Content-Length": 578,
    "Content-Type": "text/html"
  });
  
  res.write([
    "<!DOCTYPE html><html><head><title>501: Not Implemented</title></head><body>",
    "<div style=\"width: 40em; color: #444!important; font-family: sans-serif; line-height: 1.4em; margin: 3em;\">",
    "<h1>501: Not Implemented</h1>",
    "<p>The thingy you wanted to talk to didn't get setup to talk back,<br /> deepest apologies.</p>",
    "<hr style=\"margin: 0 -1em; border: 1px solid #aaa!important; border-width: 1px 0 0 0!important; background: #aaa!important;\"/>",
    "<p><small>This thingy is brought to you with the help of <a href=\"http://nodejs.org/\" title=\"Project Website\">Node.js</a>.</p>",
    "</div>",
    "</body></html>"].join("")
  );
  
  res.end();
};

Server.prototype.dispatch_ws = function(req){
  
};