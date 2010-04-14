
// System
var sys =    require("sys"),
    net =    require("net"),
    events = require("events"),
    path =   require("path");


require.paths.unshift(path.join(__dirname, "ws"));
require.paths.unshift(__dirname);

// Local
var Connection = require('ws/connection'),
    Utils = require('ws/utilities');

function Server(options){
  net.Server.call(this);
  
  var self = this,
      address = null,
      port = null,
      options = options || {};
    
  this.addListener("listening", function(){
    var tmp = self.address();
    address = tmp.address;
    port = tmp.port;
  });
  
  this.addListener("connection", function(socket){
    socket.host = address;
    socket.port = port;
    options.origin = options.origin || "*";
    var handler = new Connection(socket, options);
  });
  
  this.addListener("error", function(e){
    Utils.log("ERROR: "+e);
  });
  
  this.addListener("close", function(e){
    Utils.log("CLOSED");
  });
};

sys.inherits(Server, net.Server);
exports.Server = Server;

