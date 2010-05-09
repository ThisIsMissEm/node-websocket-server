var sys = require("sys");

exports.dispatch = function(req){
  var conn = new Connection(req, this);
  this.clients.push(conn);
  this.emit("dispatch", conn);
};


function Connection(req, server){
  var s = this;
  
  sys.log("new connection");
  
  
  this._connected = false;
  this._req = req;
  this._server = server;
  this._socket = req.socket;
  this._socket.ondata = function(){
    s.ondata.apply(s, arguments);
  };
    
  this.setup();
};

Object.defineProperty(Connection.prototype, 'readyState', {
  get: function(){
    if(this._connected){
      return 1;
    } else if(!this._connected){
      return 0;
    }
  }
});

Connection.prototype.setup = function(){
  var sOrigin = this._server.options.origin,
      sSubProtocol = this._server.options.subprotocol;
  
  var connection = this.connection = {
    host: this._server.connection.host,
    port: this._server.connection.port,
    resource: this._req.url,
    secure: false,
    origin: sOrigin == "*" || typeof sOrigin == "Array" ? this._req.headers["origin"] : sOrigin,
    subprotocol: sSubProtocol == "*" || typeof sSubProtocol == "Array" ? this._req.headers["subprotocol"] || null : sSubProtocol,
    key1: this._req.headers["sec-websocket-key1"],
    key2: this._req.headers["sec-websocket-key2"],
    key3: this._req.upgradeHead
  };
  
  for(var i=1; i<3; i++){
    var value = connection["key"+i];
    connection["key"+i+"_number"] = parseInt(value.match(/[0-9]+/gi).join(''), 10),
    connection["key"+i+"_spaces"] = value.match(/\ +/gi).join('').length;
  }
  
  connection.location = [
      connection.secure ? "wss://" : "ws://",
      connection.host,
      (!connection.secure && connection.port != 80 || connection.secure && connection.port != 443) ? ":"+connection.port : "",
      connection.resource
    ].join('');
  
  if(connection.key3.length > 1){
    this.handshake();
  }
};

Connection.prototype.handshake = function(){
  sys.log("handshake...");
  sys.p(this.connection);
}

Connection.prototype.ondata = function(d, start, end){
  var slice = d.toString('utf8', start, end);
  sys.p(slice);
  
  if(this.readyState == 0 && (this.connection.key3 && this.connection.key3.length <= 1)){
    this.connection.key3 = d.slice(start, end);
    this.handshake();
  } else {
    // handle message;
  }
};