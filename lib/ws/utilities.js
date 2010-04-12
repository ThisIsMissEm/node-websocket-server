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