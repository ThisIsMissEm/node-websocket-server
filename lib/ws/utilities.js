var sys = require("sys");

exports.log_level = 3;

exports.log = function(data){
  if(exports.log_level > 0){
    sys.log(data);
  }
}

exports.debug = function(data){
  if(exports.log_level > 2){
    sys.log(">> "+sys.inspect(data));
  }
};


exports.asciiStrToLower = function(str){
  return str.replace(/([A-Z]*)/gm, function(s, match){
    return match.toLowerCase();
  });
};

exports.addU32 = function (/* ... */) {
  var acc = 0;
  for (var i = 0; i < arguments.length; i++) {
    var x = arguments[i];
    var lsw = (acc & 0xFFFF) + (x & 0xFFFF);
    var msw = (acc >> 16) + (x >> 16) + (lsw >> 16);
    acc = (msw << 16) | (lsw & 0xFFFF);
  }
  return acc;
};