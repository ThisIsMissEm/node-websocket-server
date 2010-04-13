
var sys    = require("sys"),
    events = require("events"),
    Buffer = require("buffer").Buffer;

var Utils = require('utilities');

var parsers = require("http_parser").parsers;


function Connection(socket){
  events.EventEmitter.call(this);
  
  var self = this;
  
  this.parser = parsers.alloc();
  this.parser.reinitialize('request');
  this.parser.onIncoming = function (req) {
    Utils.debug(req);
    
    var location = ["ws://",
      req.headers.host,
      req.url
    ].join('');
    
    self.socket.write([
      "HTTP/1.1 101 Web Socket Protocol Handshake",
      "Upgrade: WebSocket",
      "Connection: Upgrade",
      "WebSocket-Origin: "+req.headers.origin,
      "WebSocket-Location: "+location,
      "\r\n"].join("\r\n")
    , "utf8");
    
    self.readyState = 1;
    self.parser.finish();
    parsers.free(self.parser);
  };
  
  this.readyState = 0;
  
  this.socket = socket;
  this.socket.ondata = function(){
    self.ondata_experimental.apply(self, arguments);
  };
  
  this.socket.addListener("error", function(e){
    Utils.debug(e);
  })
  
  
  this.socket.addListener("close", function(){
    Utils.log("Connection Closed.");
  });
  
  //this.addListener("handshake", this.handshake);
};

sys.inherits(Connection, events.EventEmitter);
module.exports = Connection;

Connection.prototype.ondata_experimental = function(data, start, end){
  var slice = data.toString('utf8', start, end);
  
  Utils.debug(slice);
  
  // First! Check if the client has sent bad data, ie, ^C via telnet.
  if(this.readyState == 1) {
    this.onmessage(slice);
  } else {
    this.parser.execute(data, start, end-start);
  }
};

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
    } else if(token == "host") {
      value = value.split(":");
      ws.connection["host"] = value[0] || this.socket.address;
      ws.connection["port"] = value[1] || this.socket.port;
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
  
  if(ws.connection["key_1"] && ws.connection["key_2"]){
    if(parts.length > 0 && parts[0] != ""){
      this.onbody(parts.shift());
      this.waitingForBody = false;
    } else {
      this.waitingForBody = true;
    }
  } else {
    ws.waitingForBody = false;
    Utils.log("missing_body");
    ws.emit("handshake");
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
  tmp = undefined;
  
  this.emit("handshake");
};

Connection.prototype.kill = function(){
  this.socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
  this.socket.close();
  this.emit("killed");
};

Connection.prototype.send = function(data){
  Utils.log("send: "+data)
  this.socket.write("\u0000", "binary");
  this.socket.write(data, "utf8");
  this.socket.write("\uffff", "binary");
};

Connection.prototype.write = function(data, encoding){
  Utils.log("<< "+data);
  this.socket.write(data, encoding);
}

Connection.prototype.handshake = function(){
  var conn = this.connection;
  Utils.log("handshake!");
  Utils.debug(conn);
  if( conn["key_1"] && conn["key_2"] && (conn["key_1"][1].length <= 0 || 
      conn["key_1"][0] % conn["key_1"][1] !== 0 ||
      conn["key_2"][1].length <= 0 || 
      conn["key_2"][0] % conn["key_2"][1] !== 0)
  ){
    this.kill();
  } else {
    //var part1 = conn["key_1"][0] / conn["key_1"][1],
    //    part2 = conn["key_2"][0] / conn["key_2"][1];
    
    
//    String.fromCharCode(part1 >>> 16, part1 & 0xFFFF)+String.fromCharCode(part2 >>> 16, part2 & 0xFFFF) + conn["key_3"]
    
    this.write([
      "HTTP/1.1 101 Web Socket Protocol Handshake",
      "Upgrade: WebSocket",
      "Connection: Upgrade",
      "WebSocket-Origin: "+this.connection.origin,
      "WebSocket-Location: "+this.connection.location,
      "\r\n"].join("\r\n")
//      "Sec-WebSocket-Origin: "+this.connection.origin,
//      "Sec-WebSocket-Protocol: "+ this.connection.subprotocol,
//      ""
//      ""
    , "utf8");
    
    this.emit("ready");
  }
  /* else {
    var part1 = Utils.addU32(conn["key_1"][0] / conn["key_1"][1], 0),
        part2 = Utils.addU32(conn["key_2"][0] / conn["key_2"][1], 0);
    
    var tmp = [part1, part2, conn["key_3"]].join('');
    sys.p(tmp);
    
    var tmp2 = new Buffer(128);
    tmp2.write("0x36 0x09 0x65 0x65 0x0A 0xB9 0x67 0x33 0x57 0x6A 0x4E 0x7D 0x7C 0x4D 0x28 0x36", "utf8");
    sys.p(tmp2.toString("utf8", 0, 128))
  }*/
//  this.emit("ready");
};


Connection.prototype.onmessage = function(message){
  Utils.log(message.substr(0,message.length-1));
};