
var sys    = require("sys"),
    events = require("events"),
    Buffer = require("buffer").Buffer;

var Utils = require('utilities');

var parsers = require("http_parser");


function Connection(socket, options){
  events.EventEmitter.call(this);
  
  this.readyState = 0;
  this.socket = socket;
  this.options = options;
  
  this.initializeParser();
};

sys.inherits(Connection, events.EventEmitter);
module.exports = Connection;

Connection.prototype.initializeParser = function(){
  var ws = this;
  ws.key3 = false;
  ws.parser = parsers.alloc();
  ws.parser.reinitialize('request');
  
  ws.parser.onIncoming = function () {
    Utils.log("Headers Finished!");
    ws.parser.finish();
    parsers.free(ws.parser);
  };
  
  ws.parser.onEnd = function(req){
    Utils.log(ws.key3);
    if(!req.headers["sec-websocket-key1"]){
      ws.onConnect(req);
    } else {
      ws.req = req;
    }
  };
  
  this.socket.ondata = function(data, start, end){
    var slice = data.toString('utf8', start, end);
    
    Utils.debug(slice);
    
    if(ws.readyState == 1) {
      ws.onmessage(slice);
    } else {
      var bytesParsed = ws.parser.execute(data, start, end - start);
      if (ws.parser.incoming && ws.parser.incoming.upgrade) {
        ws.parser.incoming.upgradeHead = data.toString("utf8", start + bytesParsed + 1, end - start - 2);

        ws.readyState = 1;

        Utils.debug(ws.parser.incoming);
      }
      
    }
  };
};

Connection.prototype.onConnect = function(req){
  Utils.debug(req);
  
  var origin = this.options.origin;
  if(this.options.origin == "*" || typeof this.options.origin == "Array"){
    origin = req.headers.origin;
  }
  
  var subprotocol = this.options.subprotocol || null;
  if(typeof this.options.subprotocol == "Array"){
    subprotocol = req.headers["sec-websocket-protocol"] || null;
  }
  
  this.connection = {
    host: this.socket.host,
    port: this.socket.port,
    resource: req.url,
    secure: false,
    origin: origin,
    subprotocol: subprotocol,
    key1: req.headers["sec-websocket-key1"] || null,
    key2: req.headers["sec-websocket-key2"] || null,
    key3: this.key3
  }
  
  Utils.debug(this.connection);
}





Connection.prototype.onconnect = function(data){
  var ws = this;
  
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
};
/*
Connection.prototype.handshake = function(req){
  Utils.log("handshake!");
  Utils.debug(req);
  
  
  
  
//  if( conn["key_1"] && conn["key_2"] && (conn["key_1"][1].length <= 0 || 
//      conn["key_1"][0] % conn["key_1"][1] !== 0 ||
//      conn["key_2"][1].length <= 0 || 
//      conn["key_2"][0] % conn["key_2"][1] !== 0)
//  ){
//    this.kill();
//  } else {
    //var part1 = conn["key_1"][0] / conn["key_1"][1],
    //    part2 = conn["key_2"][0] / conn["key_2"][1];
    
    
//    String.fromCharCode(part1 >>> 16, part1 & 0xFFFF)+String.fromCharCode(part2 >>> 16, part2 & 0xFFFF) + conn["key_3"]
    
    this.write([
      "HTTP/1.1 101 Web Socket Protocol Handshake",
      "Upgrade: WebSocket",
      "Connection: Upgrade",
      "WebSocket-Origin: "+req.headers.origin,
      "WebSocket-Location: ws://" + this.socket.address+":"+this.socket.port + req.url,
      "\r\n"].join("\r\n")
//      "Sec-WebSocket-Origin: "+this.connection.origin,
//      "Sec-WebSocket-Protocol: "+ this.connection.subprotocol,
//      ""
//      ""
    , "utf8");
    this.readyState = 1;
    this.emit("ready", req);
//  }
  /* else {
    var part1 = Utils.addU32(conn["key_1"][0] / conn["key_1"][1], 0),
        part2 = Utils.addU32(conn["key_2"][0] / conn["key_2"][1], 0);
    
    var tmp = [part1, part2, conn["key_3"]].join('');
    sys.p(tmp);
    
    var tmp2 = new Buffer(128);
    tmp2.write("0x36 0x09 0x65 0x65 0x0A 0xB9 0x67 0x33 0x57 0x6A 0x4E 0x7D 0x7C 0x4D 0x28 0x36", "utf8");
    sys.p(tmp2.toString("utf8", 0, 128))
  }
//  this.emit("ready");
};*/


Connection.prototype.onmessage = function(message){
  Utils.log(message.substr(0,message.length-1));
};