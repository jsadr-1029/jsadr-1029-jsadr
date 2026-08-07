// Quick domain check
const TOKEN = process.env.VERCEL_TOKEN_NEW;
const https = require('https');

function apiCall(path) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.vercel.com',
      path: path,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${TOKEN}` }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  const NEW_PROJECT_ID = 'prj_JQV6HJQB65nmSEp45Z1FFPmxARtj';
  
  const res = await apiCall(`/v9/projects/${NEW_PROJECT_ID}/domains`);
  console.log('Status:', res.status);
  console.log('Body:', res.body);
})();
