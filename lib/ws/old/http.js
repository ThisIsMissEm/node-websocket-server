var http = require("http"), responses = [];

exports.createResponse = function(req){
  return new Response(req);
};
exports.Response = Response;

function Response(req){
  var res = new http.ServerResponse(req);
  
  res.shouldKeepAlive = false;
  res.closeOnFinish = true;
  res.addListener('flush', function () {
    if (flushMessageQueue(req.socket, responses)) {
      req.socket.end();
    }
  });
  
  responses.push(res);
  
  return res;
};

function flushMessageQueue (socket, queue) {
  var message;
  for(;queue.length && (message = queue.shift());) {
    var message = queue[0];

    while (message.output.length > 0) {
      if (!socket.writable) return true;

      var data = message.output.shift();
      var encoding = message.outputEncodings.shift();

      socket.write(data, encoding);
    }

    if (!message.finished) break;

    message.emit("sent");
    return true;
  }
  return false;
};