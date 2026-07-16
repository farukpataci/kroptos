const http = require('http');

function post(url, headers, body) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function run() {
  console.log('Logging in...');
  const loginRes = await post('http://localhost:3001/api/auth/login', {}, {
    email: 'superadmin@kroptos.com',
    password: 'Password123!',
  });

  if (loginRes.statusCode !== 200 && loginRes.statusCode !== 201) {
    console.error('Login failed:', loginRes.statusCode, loginRes.body);
    return;
  }

  const loginData = JSON.parse(loginRes.body);
  const token = loginData.accessToken;
  console.log('Login success. Token acquired.');

  const integrationId = 'cmqz6xonh0008m0y33bb150m9';
  console.log(`Triggering sync for integration ${integrationId}...`);

  const syncRes = await post(
    `http://localhost:3001/api/integrations/${integrationId}/sync`,
    {
      'Authorization': `Bearer ${token}`,
      'x-agency-id': 'cmqs8k85b000213co7nxm3na8',
    },
    {}
  );

  console.log('Sync API Response Status:', syncRes.statusCode);
  console.log('Sync API Response Body:', syncRes.body);
}

run().catch(console.error);
