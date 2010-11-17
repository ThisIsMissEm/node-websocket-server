var events = require("events")
  , Buffer = require("buffer").Buffer;

(Parser = function(version){
  this.version = version.toLowerCase() || this.version; 
  if(this.version == "draft76" || this.version == "draft75") {
    this.frameData = [];
    this.frameStage = "begin";
  }
}).prototype = {
  __proto__: events.EventEmitter.prototype,
  version: "draft76", readable: true, paused: false,
  frameData: null, frameStage: null,
  write: function(data){
    var pkt, msg;
    for(var i = 0, len = data.length; i<len; i++) {
      switch(this.order) {
        case 0:
          this.order = (data[i] & 0x80 == 0x80) ? 1 : -1;
          break;
        case -1:
          if(data[i] === 0xFF){
            pkt = new Buffer(this.frameData);
            this.order = 0;
            this.frameData = [];  
            this.emit("data", pkt.toString("utf8", 0, pkt.length));
          } else {
            this.frameData.push(data[i]);
          }
          break;
        case 1:
          this.emit("error", "High Order packet handling is not yet implemented.");
          this.order = 0;
          break;
      }
    }
  },
  destroy: function() {
    delete this.order;
    delete this.frameData;
  }
};

module.exports = Parser;