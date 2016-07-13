require('http').createServer(function (req, res) {
  var extra = req.url === '/tests' ? '/index.html' : '';
  if (req.url[0] !== '/') req.url = 'tests/' + req.url;
  var filePath = '.' + req.url + extra;
  if (req.url.match(/.css$/)) res.setHeader('Content-Type', 'text/css');
  var s = require('fs').createReadStream(filePath);
  s.pipe(res);
  s.on('error', function () {});
}).listen(8082);
console.log('Started server; open http://localhost:8082/tests/ in the browser');
