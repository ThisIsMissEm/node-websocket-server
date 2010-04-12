
var sys    = require("sys"),
    events = require("events"),
    Buffer = require("buffer").Buffer;

var Utils = require('utilities');



function Connection(socket){
  events.EventEmitter.call(this);
  
  var self = this;
  
  this.socket = socket;
  this.waitingForBody = false;
  this.socket.ondata = function(){
    self.ondata.apply(self, arguments);
  };
  
  this.addListener("handshake", this.handshake);
};

sys.inherits(Connection, events.EventEmitter);
module.exports = Connection;

Connection.prototype.ondata = function(data, start, end){
  var slice = data.toString('utf8', start, end);
  
  Utils.debug(slice);
  
  // First! Check if the client has sent bad data, ie, ^C via telnet.
  if(slice.substr(0,2) == "\ufffd\ufffd"){
    Utils.log("Received Bad Command");
  
  // Assume we're trying to start a websocket handshake.
  } else if(/^GET /.test(slice)){
    this.waitingForBody = true;
    this.onconnect(slice);
  
  // We need to grab the body of the initial Request.
  } else if(this.waitingForBody && slice.substr(0,1) != "\ufffd") {
    this.onbody.apply(this, [slice]);
  
  // Must be websocket data, as it's outside the set UTF-8 range.
  } else if(slice.substr(0,1) == "\ufffd") {
    this.onmessage(slice);
  }
};

Connection.prototype.onconnect = function(data){
  var parts   = data.split("\r\n\r\n"),
      headers = parts.shift().split("\r\n"),
      ws      = this;
  
  this.connection = {
    host: this.socket.address,
    port: this.socket.port,
    resource: headers.shift().match(/^GET (\/[^\s]*)/)[1]
  };
  
  headers.forEach(function(header){
    var tokens = header.split(": "),
        token = Utils.asciiStrToLower(tokens.shift()),
        value = tokens.join(": ");

    if(token == "sec-websocket-protocol"){
      token = "subprotocol";
    }

    if(token == "sec-websocket-key1" || token == "sec-websocket-key2"){
      ws.parseSecurityHeaders(token, value);
    } else {
      ws.connection[token] = value;
    }
  });
  
  // explicitly set.
  ws.connection.secure = false;
  
  // Butt ugly, but does the job.
  ws.connection.location = [
    ws.connection.secure ? "wss://" : "ws://",
    ws.connection.host,
    (!ws.connection.secure && ws.connection.port != 80 || ws.connection.secure && ws.connection.port != 443) ? ":"+ws.connection.port : "",
    ws.connection.resource
  ].join('');
  
  if(parts.length > 0 && parts[0] != ""){
    this.onbody(parts.shift());
    this.waitingForBody = false;
  }
};

Connection.prototype.parseSecurityHeaders = function(header, value){
  var key_number = header.match(/(1|2)$/g)[0],
      number = parseInt(value.match(/[0-9]+/gi).join(''), 10),
      spaces = value.match(/\ +/gi).join('').length;
  
  this.connection["key_"+key_number] = [number, spaces];
};

Connection.prototype.onbody = function(body){
  if(this.connection.key_3) return;
  
  var tmp = new Buffer(8);
  tmp.write(body, "utf8", 0);
  
  this.connection.key_3 = tmp.toString("utf8", 0, 8);
  delete tmp;
  
  this.emit("handshake");
};

Connection.prototype.handshake = function(){
  Utils.log("handshake!");
  
//  this.emit("ready");
};


Connection.prototype.onmessage = function(){};