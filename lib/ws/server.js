var http   = require("http")
  , events = require("../_events")
  , Manager = require("./manager")
  , Connection = require("./connection");

function w(c, data) { c && c._state === 4 && c.write(data) };

(Server = function(o) {
  if(!o.server) o.server = new http.Server;
  if(!o.debug) o.debug = false;  
  
  this.manager = new Manager(this.options = o);

  o.server.on("upgrade", function(req, socket, upgradeHead) {
    req.method == "GET" && ( req.headers["upgrade"] && req.headers["connection"] )
    && req.headers.upgrade.toLowerCase() == "websocket" && req.headers.connection.toLowerCase() == "upgrade"
    && new Connection(this.manager, o, req, socket, upgradeHead); 
  });

  this.manager.bubbleEvent("error", this);

  events.reflectEvents( this.manager, ['attach'], this, 'connection');
  events.reflectEvents( this.manager, ['detach'], this, 'disconnect');
  events.reflectEvents( o.server, ['listening','request','stream','close','clientError','error'], this);
  events.reflectMethods( o.server,  ["listen",'close'], this);

}).prototype = {
  __proto__: events.EventEmitter.prototype,
  manager: null, options: null,
  send: function(id, data) {
    this.manager.find(id, function(c) { w(c, data) });
  },
  broadcast: function(data) {
    this.manager.forEach(function(c) { w(c, data) });
  }
};

exports.Server = Server;
exports.createServer = function(o) { return new Server(o) };