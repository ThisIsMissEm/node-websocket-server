
var sys = require("sys"),
    events = require("events");


module.exports = Connection;

/*-----------------------------------------------
  The Connection:
-----------------------------------------------*/
function Connection(server, req, socket, upgradeHead){
  sys.log("new connection: using "+(server.options.version || "spec"));
  events.EventEmitter.call(this);
  
  this._req = req;
  this._server = server;
  this._state = 1;
  
  this.setup();

  if(upgradeHead && upgradeHead.length == 8){
    handshake.call(this);
  } else if (server["options"] && server["options"]["version"] && server.options.version == "draft75"){
    handshake.call(this);
  } else {
    this._state = 2;
    sys.log("waiting.")
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
Connection.prototype._state = 0;


/*-----------------------------------------------
  Setup the various event handlers
-----------------------------------------------*/
Connection.prototype.setup = function(){
  var conn = this;
  
  this._req.socket.ondata = function(data, start, end){
    ondata.call(conn, data, start, end);
  };
};

/*-----------------------------------------------
  The new onData callback for 
  http.Server IncomingMessage
-----------------------------------------------*/
function ondata(data, start, end){
  sys.log("recv: '"+ data.toString("utf8")+"'");
  if(this._state == 2){
    
    //data.copy(this._req.upgradeHead, 0, start, end);
    handshake.call(this);
  } else if(this._state == 4){
    data = data.slice(start, end);
    this.emit("message", data.toString("utf8"));
  }
};

/*-----------------------------------------------
  Do the handshake.
-----------------------------------------------*/
function handshake(){
  sys.log("handshake");
  sys.p(this._req.upgradeHead.toString("utf8"));
  this._state = 3;
}