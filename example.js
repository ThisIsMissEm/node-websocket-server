var ws = require('./lib/ws');

var server = new ws.Server();

server.addListener("connect", function(){
  sys.puts("connect!");
});

server.addListener("ready", function(s){
  setTimeout(function(){
    s.send(JSON.stringify({message: "test"}));
  }, 1000);
});

server.listen(7000, '192.168.46.19');