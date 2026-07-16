const http = require('http');

const data = JSON.stringify({
  email: 'faruk.pataci@gmail.com',
  password: '12341234'
});

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('Response body:', body);
  });
});

req.on('error', (err) => {
  console.error('Request Error details:', err);
});

req.write(data);
req.end();
