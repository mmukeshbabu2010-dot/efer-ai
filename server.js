import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_PORT = Number(process.env.PORT) || 3000;
const DEFAULT_HOST = '0.0.0.0';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] ?? 'application/octet-stream';
}

function getCacheControl(relativePath, ext) {
  if (ext === '.html') {
    return 'no-cache';
  }
  if (relativePath.startsWith('assets/') || relativePath.startsWith('fonts/')) {
    return 'public, max-age=31536000, immutable';
  }
  return 'public, max-age=3600';
}

async function fileExists(targetPath) {
  try {
    const stat = await fs.stat(targetPath);
    return stat.isFile();
  } catch {
    return false;
  }
}

export function createProductionServer(distDir = path.resolve(process.cwd(), 'dist')) {
  const resolvedDistDir = path.resolve(distDir);
  const indexHtmlPath = path.join(resolvedDistDir, 'index.html');

  return http.createServer(async (req, res) => {
    const method = req.method ?? 'GET';
    const rawUrl = req.url ?? '/';

    let pathname = '/';
    try {
      const parsed = new URL(rawUrl, 'http://localhost');
      pathname = decodeURIComponent(parsed.pathname);
    } catch {
      res.writeHead(400, {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end('Bad Request');
      return;
    }

    if (pathname === '/health') {
      const buildReady = await fileExists(indexHtmlPath);
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(JSON.stringify({ status: 'ok', buildReady }));
      return;
    }

    if (method !== 'GET' && method !== 'HEAD') {
      res.writeHead(405, {
        'Content-Type': 'text/plain; charset=utf-8',
        Allow: 'GET, HEAD',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end('Method Not Allowed');
      return;
    }

    const sanitizedRelative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const candidatePath = path.resolve(resolvedDistDir, sanitizedRelative);

    if (
      candidatePath !== resolvedDistDir &&
      !candidatePath.startsWith(`${resolvedDistDir}${path.sep}`)
    ) {
      res.writeHead(403, {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end('Forbidden');
      return;
    }

    let fileToServe = null;
    let servedRelativePath = sanitizedRelative;

    if (await fileExists(candidatePath)) {
      fileToServe = candidatePath;
    } else {
      const hasExtension = path.extname(sanitizedRelative) !== '';
      if (!hasExtension && (await fileExists(indexHtmlPath))) {
        fileToServe = indexHtmlPath;
        servedRelativePath = 'index.html';
      }
    }

    if (!fileToServe) {
      const hasBuild = await fileExists(indexHtmlPath);
      if (!hasBuild) {
        res.writeHead(503, {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        });
        res.end('Production build not found in dist/. Run "npm run build" before starting.');
        return;
      }

      res.writeHead(404, {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end('Not Found');
      return;
    }

    try {
      const data = await fs.readFile(fileToServe);
      const ext = path.extname(fileToServe).toLowerCase();
      res.writeHead(200, {
        'Content-Type': getMimeType(fileToServe),
        'Content-Length': data.byteLength,
        'Cache-Control': getCacheControl(servedRelativePath, ext),
        'X-Content-Type-Options': 'nosniff',
      });
      if (method === 'HEAD') {
        res.end();
      } else {
        res.end(data);
      }
    } catch {
      res.writeHead(500, {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end('Internal Server Error');
    }
  });
}

const isExecutedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isExecutedDirectly) {
  const server = createProductionServer();
  server.listen(DEFAULT_PORT, DEFAULT_HOST, () => {
    console.log(`EFER AI production server listening on http://${DEFAULT_HOST}:${DEFAULT_PORT}`);
  });
}
