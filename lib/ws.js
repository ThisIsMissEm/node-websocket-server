
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

function Server(){
  net.Server.call(this);
  
  var self = this,
      address = null,
      port = null;
  
  this.channels = {};
  
  this.addListener("listening", function(){
    var tmp = self.address();
    address = tmp.address;
    port = tmp.port;
    
    delete tmp;
  });
  
  this.addListener("connection", function(socket){
    socket.address = address;
    socket.port = port;
    var handler = new Connection(socket);
    handler.addListener("ready", function(){
      if(!(this.connection.resource in self.channels)){
        self.channels[this.connection.resource] = [];
      }
      self.channels[this.connection.resource].push(handler);
      Utils.debug(self.channels);
    });
  });
  
  this.addListener("data", function(data){
    utils.debug(data);
  })
};

sys.inherits(Server, net.Server);
exports.Server = Server;

