import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_PORT = Number(process.env.PORT) || 3000;
const DEFAULT_HOST = '0.0.0.0';
const MAX_CHAT_BODY_BYTES = 1_048_576; // 1 MB

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

function sendJsonError(res, statusCode, message) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify({ error: message }));
}

async function readJsonBody(req, maxBytes = MAX_CHAT_BODY_BYTES) {
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > maxBytes) {
      throw Object.assign(new Error('Request payload too large.'), { statusCode: 413 });
    }
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) {
    throw Object.assign(new Error('Request body is required.'), { statusCode: 400 });
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw Object.assign(new Error('Invalid JSON payload.'), { statusCode: 400 });
  }
}

function normalizeIncomingMessages(rawMessages) {
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    return [];
  }
  return rawMessages
    .filter(
      (msg) =>
        msg &&
        typeof msg === 'object' &&
        (msg.role === 'system' || msg.role === 'user' || msg.role === 'assistant') &&
        typeof msg.content === 'string' &&
        msg.content.trim().length > 0,
    )
    .map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
}

function writeSseText(res, text) {
  if (!text) return;
  res.write(`data: ${JSON.stringify({ text })}\n\n`);
}

async function forwardOpenAiCompatibleStream(upstreamRes, res) {
  const contentType = upstreamRes.headers.get('content-type') ?? '';
  if (!upstreamRes.body || contentType.includes('application/json')) {
    const data = await upstreamRes.json();
    const text = data?.choices?.[0]?.message?.content ?? '';
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(JSON.stringify({ text }));
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store',
    Connection: 'keep-alive',
    'X-Content-Type-Options': 'nosniff',
  });

  const reader = upstreamRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') {
          res.write('data: [DONE]\n\n');
          res.end();
          return;
        }
        try {
          const parsed = JSON.parse(payload);
          const text = parsed?.choices?.[0]?.delta?.content ?? '';
          writeSseText(res, text);
        } catch {
          // Ignore malformed keepalive chunk
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  res.write('data: [DONE]\n\n');
  res.end();
}

async function forwardGeminiStream(upstreamRes, res) {
  const contentType = upstreamRes.headers.get('content-type') ?? '';
  if (!upstreamRes.body || contentType.includes('application/json')) {
    const data = await upstreamRes.json();
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    const text = parts.map((p) => p?.text ?? '').join('');
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(JSON.stringify({ text }));
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store',
    Connection: 'keep-alive',
    'X-Content-Type-Options': 'nosniff',
  });

  const reader = upstreamRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const parsed = JSON.parse(payload);
          const parts = parsed?.candidates?.[0]?.content?.parts ?? [];
          for (const part of parts) {
            if (typeof part?.text === 'string' && part.text.length > 0) {
              writeSseText(res, part.text);
            }
          }
        } catch {
          // Ignore malformed SSE comment
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  res.write('data: [DONE]\n\n');
  res.end();
}

async function handleProxyChat(req, res, fetchImpl) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    sendJsonError(res, err?.statusCode ?? 400, err?.message ?? 'Invalid request body.');
    return;
  }

  const modelId = typeof body?.modelId === 'string' ? body.modelId.trim() : '';
  const messages = normalizeIncomingMessages(body?.messages);

  if (!modelId.startsWith('proxy:') || messages.length === 0) {
    sendJsonError(res, 400, 'Valid proxy modelId and non-empty messages array are required.');
    return;
  }

  const controller = new AbortController();
  req.on('close', () => {
    if (!res.writableEnded) {
      controller.abort();
    }
  });

  try {
    if (modelId === 'proxy:gemini-flash') {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        sendJsonError(res, 503, 'GEMINI_API_KEY is not configured on the server.');
        return;
      }

      const systemParts = messages
        .filter((m) => m.role === 'system')
        .map((m) => ({ text: m.content }));
      const contents = messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));

      const upstreamRes = await fetchImpl(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            ...(systemParts.length > 0
              ? { systemInstruction: { parts: systemParts } }
              : {}),
            contents,
          }),
          signal: controller.signal,
        },
      );

      if (!upstreamRes.ok) {
        sendJsonError(res, upstreamRes.status, `Upstream Gemini proxy HTTP ${upstreamRes.status}.`);
        return;
      }

      await forwardGeminiStream(upstreamRes, res);
      return;
    }

    if (modelId === 'proxy:groq-llama' || modelId === 'proxy:openrouter') {
      const isGroq = modelId === 'proxy:groq-llama';
      const apiKey = isGroq ? process.env.GROQ_API_KEY : process.env.OPENROUTER_API_KEY;
      const envName = isGroq ? 'GROQ_API_KEY' : 'OPENROUTER_API_KEY';

      if (!apiKey) {
        sendJsonError(res, 503, `${envName} is not configured on the server.`);
        return;
      }

      const endpoint = isGroq
        ? 'https://api.groq.com/openai/v1/chat/completions'
        : 'https://openrouter.ai/api/v1/chat/completions';
      const upstreamModel = isGroq ? 'llama-3.3-70b-versatile' : 'openrouter/auto';

      const upstreamRes = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: upstreamModel,
          stream: true,
          messages,
        }),
        signal: controller.signal,
      });

      if (!upstreamRes.ok) {
        sendJsonError(
          res,
          upstreamRes.status,
          `Upstream ${isGroq ? 'Groq' : 'OpenRouter'} proxy HTTP ${upstreamRes.status}.`,
        );
        return;
      }

      await forwardOpenAiCompatibleStream(upstreamRes, res);
      return;
    }

    sendJsonError(res, 400, `Unsupported proxy model "${modelId}".`);
  } catch (err) {
    if (err?.name === 'AbortError' || controller.signal.aborted) {
      if (!res.writableEnded) res.end();
      return;
    }
    if (!res.headersSent) {
      sendJsonError(res, 502, 'Upstream AI provider request failed.');
    } else if (!res.writableEnded) {
      res.end();
    }
  }
}

export function createProductionServer(
  distDir = path.resolve(process.cwd(), 'dist'),
  options = {},
) {
  const resolvedDistDir = path.resolve(distDir);
  const indexHtmlPath = path.join(resolvedDistDir, 'index.html');
  const fetchImpl = options.fetchImpl ?? fetch;

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

    if (pathname === '/api/providers' && (method === 'GET' || method === 'HEAD')) {
      const body = JSON.stringify({
        configured: {
          gemini: Boolean(process.env.GEMINI_API_KEY),
          groq: Boolean(process.env.GROQ_API_KEY),
          openrouter: Boolean(process.env.OPENROUTER_API_KEY),
        },
        note: 'API keys remain strictly server-side.',
      });
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(method === 'HEAD' ? undefined : body);
      return;
    }

    if (pathname === '/api/chat' && method === 'POST') {
      await handleProxyChat(req, res, fetchImpl);
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
