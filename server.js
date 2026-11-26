import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';

const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

const server = http.createServer(async (req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  let readme = '# efer-ai';
  try {
    readme = await fs.readFile(path.join(process.cwd(), 'README.md'), 'utf-8');
  } catch {
    // Fallback to default title if README.md is unavailable
  }

  const escapedReadme = readme
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>efer-ai</title>
  </head>
  <body style="font-family: system-ui, sans-serif; max-width: 640px; margin: 4rem auto; padding: 0 1.5rem; line-height: 1.6; color: #111827;">
    <pre style="font-size: 1.5rem; font-weight: 700; margin: 0 0 1rem;">${escapedReadme}</pre>
    <p style="color: #4b5563;">
      The imported repository (<code>mmukeshbabu2010-dot/efer-ai</code>) only contained <code>README.md</code> with no application source code or dependencies.
    </p>
  </body>
</html>`);
});

server.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
});
