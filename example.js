var ws = require('./lib/ws');

var server = new ws.Server();

server.addListener("connect", function(){
  sys.puts("connect!")
})

server.listen(7000, 'localhost');