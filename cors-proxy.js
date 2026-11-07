const express = require('express');
const { execFile } = require('child_process');

const app = express();
const PORT = 3001;

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Accept');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.get(/^\/(api|vs)\//, (req, res) => {
  const isVs = req.url.startsWith('/vs/');
  const urlPath = req.url.replace(/^\/(api|vs)/, '');
  const url = `${isVs ? 'https://vanisource.org' : 'https://vedabase.io'}${urlPath}`;

  const args = [
    '-s', '-L',
    '--max-time', '20',
    '-H', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    '-H', 'Accept-Language: en-US,en;q=0.5',
    '-H', 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    url,
  ];

  execFile('curl', args, { maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
    if (err) {
      return res.status(502).json({ error: 'curl error', message: err.message });
    }
    const body = stdout;
    if (body.trimStart().startsWith('{') || body.trimStart().startsWith('[')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    } else {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    }
    res.send(body);
  });
});

app.listen(PORT, () => {
  console.log(`CORS proxy running at http://localhost:${PORT}`);
  console.log(`Proxying vedabase.io through http://localhost:${PORT}/api`);
});
