#!/bin/bash
export PORT=8086
node --input-type=commonjs -e "
const http = require('http');
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end('{\"status\":\"healthy\"}'});
    return;
  }
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('B2B Platform Working');
});
server.listen(8086, () => console.log('Server running on 8086'));
setTimeout(() => process.exit(0), 3000);
"
