var sys = require("sys");

function pad (n, amount) {
  var amount = amount || 10;
  return n < amount ? '0' + n.toString(10) : n.toString(10);
}

function timestamp () {
  var d = new Date();
  return  [
      pad(d.getDate())
    , "/"
    , pad(d.getMonth())
    , " "
    , pad(d.getHours()), "-"
    , pad(d.getMinutes()), "-"
    , pad(d.getSeconds()), "-"
    , pad(pad(pad(d.getMilliseconds(), 10), 100), 1000)
  ].join('');
}

sys.log = exports.log = function log(data){
  sys.puts(timestamp() + ' - ' + data.toString());
};

exports.timestamp = timestamp;