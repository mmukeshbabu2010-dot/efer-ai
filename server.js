import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_PORT = Number(process.env.PORT) || 3000;
const DEFAULT_HOST = '0.0.0.0';
const MAX_CHAT_BODY_BYTES = 1_048_576; // 1 MB
const MAX_CHAT_MESSAGES = 64;
const MAX_MESSAGE_CHARS = 64_000;
const MAX_TOTAL_CHARS = 200_000;
const DEFAULT_RATE_LIMIT_MAX = 30;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
const UPSTREAM_TIMEOUT_MS = 45_000;

const ALLOWED_PROXY_MODELS = new Set([
  'proxy:gemini-flash',
  'proxy:groq-llama',
  'proxy:openrouter',
]);

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self' http://localhost:* http://127.0.0.1:* https://localhost:*",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const SECURITY_HEADERS = {
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(self), microphone=(self), geolocation=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

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

function withSecurityHeaders(req, headers = {}) {
  const merged = {
    ...SECURITY_HEADERS,
    ...headers,
  };
  if (req?.headers?.['x-forwarded-proto'] === 'https') {
    merged['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  }
  return merged;
}

function hasHiddenPathSegment(relativePath) {
  return relativePath
    .split(/[\\/]+/)
    .some((segment) => segment.startsWith('.'));
}

async function resolveSafeStaticFile(realDistDir, candidatePath) {
  try {
    const realCandidate = await fs.realpath(candidatePath);
    if (
      realCandidate !== realDistDir &&
      !realCandidate.startsWith(`${realDistDir}${path.sep}`)
    ) {
      return null;
    }
    const stat = await fs.stat(realCandidate);
    return stat.isFile() ? realCandidate : null;
  } catch {
    return null;
  }
}

function sendJsonError(req, res, statusCode, message, extraHeaders = {}) {
  res.writeHead(
    statusCode,
    withSecurityHeaders(req, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, private',
      ...extraHeaders,
    }),
  );
  res.end(JSON.stringify({ error: message }));
}

function isAllowedSameOrigin(req) {
  const originHeader = req.headers.origin;
  if (!originHeader) {
    return true;
  }
  try {
    const originUrl = new URL(originHeader);
    const forwardedHost = req.headers['x-forwarded-host'];
    const hostHeader = Array.isArray(forwardedHost)
      ? forwardedHost[0]
      : forwardedHost ?? req.headers.host;
    if (!hostHeader) {
      return false;
    }
    return originUrl.host === hostHeader.split(',')[0].trim();
  } catch {
    return false;
  }
}

function getClientIp(req) {
  const socketIp = req.socket?.remoteAddress ?? 'unknown';
  return socketIp;
}

function createRateLimiter(maxRequests, windowMs) {
  const buckets = new Map();

  return (clientKey) => {
    const now = Date.now();
    const cutoff = now - windowMs;
    const recent = (buckets.get(clientKey) ?? []).filter((ts) => ts > cutoff);

    if (recent.length >= maxRequests) {
      buckets.set(clientKey, recent);
      const retryAfterSec = Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000));
      return { allowed: false, retryAfterSec };
    }

    recent.push(now);
    buckets.set(clientKey, recent);

    if (buckets.size > 1000) {
      for (const [key, timestamps] of buckets.entries()) {
        if (timestamps.every((ts) => ts <= cutoff)) {
          buckets.delete(key);
        }
      }
    }

    return { allowed: true, retryAfterSec: 0 };
  };
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
    return { error: 'Non-empty messages array is required.', messages: [] };
  }
  if (rawMessages.length > MAX_CHAT_MESSAGES) {
    return {
      error: `Messages array exceeds limit (${MAX_CHAT_MESSAGES} items).`,
      messages: [],
    };
  }

  const normalized = [];
  let totalChars = 0;

  for (const msg of rawMessages) {
    if (
      !msg ||
      typeof msg !== 'object' ||
      (msg.role !== 'system' && msg.role !== 'user' && msg.role !== 'assistant') ||
      typeof msg.content !== 'string'
    ) {
      continue;
    }

    const trimmed = msg.content.trim();
    if (!trimmed) continue;
    if (msg.content.length > MAX_MESSAGE_CHARS) {
      return {
        error: `Individual message exceeds ${MAX_MESSAGE_CHARS} characters.`,
        messages: [],
      };
    }

    totalChars += msg.content.length;
    if (totalChars > MAX_TOTAL_CHARS) {
      return {
        error: `Combined prompt payload exceeds ${MAX_TOTAL_CHARS} characters.`,
        messages: [],
      };
    }

    normalized.push({
      role: msg.role,
      content: msg.content,
    });
  }

  if (normalized.length === 0) {
    return { error: 'At least one valid non-empty message is required.', messages: [] };
  }

  return { error: null, messages: normalized };
}

function writeSseText(res, text) {
  if (!text) return;
  res.write(`data: ${JSON.stringify({ text })}\n\n`);
}

async function forwardOpenAiCompatibleStream(upstreamRes, req, res) {
  const contentType = upstreamRes.headers.get('content-type') ?? '';
  if (!upstreamRes.body || contentType.includes('application/json')) {
    const data = await upstreamRes.json();
    const text = data?.choices?.[0]?.message?.content ?? '';
    res.writeHead(
      200,
      withSecurityHeaders(req, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, private',
      }),
    );
    res.end(JSON.stringify({ text }));
    return;
  }

  res.writeHead(
    200,
    withSecurityHeaders(req, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, private',
      Connection: 'keep-alive',
    }),
  );

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

async function forwardGeminiStream(upstreamRes, req, res) {
  const contentType = upstreamRes.headers.get('content-type') ?? '';
  if (!upstreamRes.body || contentType.includes('application/json')) {
    const data = await upstreamRes.json();
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    const text = parts.map((p) => p?.text ?? '').join('');
    res.writeHead(
      200,
      withSecurityHeaders(req, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, private',
      }),
    );
    res.end(JSON.stringify({ text }));
    return;
  }

  res.writeHead(
    200,
    withSecurityHeaders(req, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, private',
      Connection: 'keep-alive',
    }),
  );

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

async function handleProxyChat(req, res, fetchImpl, checkRateLimit) {
  if (!isAllowedSameOrigin(req)) {
    sendJsonError(req, res, 403, 'Cross-origin API requests are not permitted.');
    return;
  }

  const contentType = String(req.headers['content-type'] ?? '').toLowerCase();
  if (!contentType.startsWith('application/json')) {
    sendJsonError(req, res, 415, 'Content-Type must be application/json.');
    return;
  }

  const rateResult = checkRateLimit(getClientIp(req));
  if (!rateResult.allowed) {
    sendJsonError(
      req,
      res,
      429,
      'Rate limit exceeded. Please wait before sending another request.',
      { 'Retry-After': String(rateResult.retryAfterSec) },
    );
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (err) {
    sendJsonError(req, res, err?.statusCode ?? 400, err?.message ?? 'Invalid request body.');
    return;
  }

  const modelId = typeof body?.modelId === 'string' ? body.modelId.trim() : '';
  if (!ALLOWED_PROXY_MODELS.has(modelId)) {
    sendJsonError(req, res, 400, 'Unsupported or invalid model identifier.');
    return;
  }

  const { error: msgError, messages } = normalizeIncomingMessages(body?.messages);
  if (msgError) {
    sendJsonError(req, res, 400, msgError);
    return;
  }

  const controller = new AbortController();
  const timeoutTimer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  req.on('close', () => {
    clearTimeout(timeoutTimer);
    if (!res.writableEnded) {
      controller.abort();
    }
  });

  try {
    if (modelId === 'proxy:gemini-flash') {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        sendJsonError(req, res, 503, 'GEMINI_API_KEY is not configured on the server.');
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
        sendJsonError(req, res, upstreamRes.status, `Upstream provider HTTP ${upstreamRes.status}.`);
        return;
      }

      await forwardGeminiStream(upstreamRes, req, res);
      return;
    }

    if (modelId === 'proxy:groq-llama' || modelId === 'proxy:openrouter') {
      const isGroq = modelId === 'proxy:groq-llama';
      const apiKey = isGroq ? process.env.GROQ_API_KEY : process.env.OPENROUTER_API_KEY;
      const envName = isGroq ? 'GROQ_API_KEY' : 'OPENROUTER_API_KEY';

      if (!apiKey) {
        sendJsonError(req, res, 503, `${envName} is not configured on the server.`);
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
          req,
          res,
          upstreamRes.status,
          `Upstream provider HTTP ${upstreamRes.status}.`,
        );
        return;
      }

      await forwardOpenAiCompatibleStream(upstreamRes, req, res);
      return;
    }
  } catch (err) {
    if (err?.name === 'AbortError' || controller.signal.aborted) {
      if (!res.writableEnded) res.end();
      return;
    }
    if (!res.headersSent) {
      sendJsonError(req, res, 502, 'Upstream AI provider request failed.');
    } else if (!res.writableEnded) {
      res.end();
    }
  } finally {
    clearTimeout(timeoutTimer);
  }
}

export function createProductionServer(
  distDir = path.resolve(process.cwd(), 'dist'),
  options = {},
) {
  const resolvedDistDir = path.resolve(distDir);
  const indexHtmlPath = path.join(resolvedDistDir, 'index.html');
  const fetchImpl = options.fetchImpl ?? fetch;
  const checkRateLimit = createRateLimiter(
    options.rateLimitMax ?? DEFAULT_RATE_LIMIT_MAX,
    options.rateLimitWindowMs ?? DEFAULT_RATE_LIMIT_WINDOW_MS,
  );

  return http.createServer(async (req, res) => {
    const method = req.method ?? 'GET';
    const rawUrl = req.url ?? '/';

    let pathname = '/';
    try {
      const parsed = new URL(rawUrl, 'http://localhost');
      pathname = decodeURIComponent(parsed.pathname);
    } catch {
      res.writeHead(
        400,
        withSecurityHeaders(req, {
          'Content-Type': 'text/plain; charset=utf-8',
        }),
      );
      res.end('Bad Request');
      return;
    }

    if (pathname.includes('\0')) {
      res.writeHead(
        400,
        withSecurityHeaders(req, {
          'Content-Type': 'text/plain; charset=utf-8',
        }),
      );
      res.end('Bad Request');
      return;
    }

    let realDistDir = resolvedDistDir;
    try {
      realDistDir = await fs.realpath(resolvedDistDir);
    } catch {
      realDistDir = resolvedDistDir;
    }

    if (pathname === '/health') {
      const buildReady = (await resolveSafeStaticFile(realDistDir, indexHtmlPath)) !== null;
      res.writeHead(
        200,
        withSecurityHeaders(req, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store, private',
        }),
      );
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
      res.writeHead(
        200,
        withSecurityHeaders(req, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store, private',
        }),
      );
      res.end(method === 'HEAD' ? undefined : body);
      return;
    }

    if (pathname === '/api/chat' && method === 'POST') {
      await handleProxyChat(req, res, fetchImpl, checkRateLimit);
      return;
    }

    if (method !== 'GET' && method !== 'HEAD') {
      res.writeHead(
        405,
        withSecurityHeaders(req, {
          'Content-Type': 'text/plain; charset=utf-8',
          Allow: 'GET, HEAD',
        }),
      );
      res.end('Method Not Allowed');
      return;
    }

    const sanitizedRelative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    if (hasHiddenPathSegment(sanitizedRelative)) {
      res.writeHead(
        403,
        withSecurityHeaders(req, {
          'Content-Type': 'text/plain; charset=utf-8',
        }),
      );
      res.end('Forbidden');
      return;
    }

    const candidatePath = path.resolve(realDistDir, sanitizedRelative);

    if (
      candidatePath !== realDistDir &&
      !candidatePath.startsWith(`${realDistDir}${path.sep}`)
    ) {
      res.writeHead(
        403,
        withSecurityHeaders(req, {
          'Content-Type': 'text/plain; charset=utf-8',
        }),
      );
      res.end('Forbidden');
      return;
    }

    let fileToServe = await resolveSafeStaticFile(realDistDir, candidatePath);
    let servedRelativePath = sanitizedRelative;

    if (!fileToServe) {
      const hasExtension = path.extname(sanitizedRelative) !== '';
      if (!hasExtension) {
        const spaIndex = await resolveSafeStaticFile(realDistDir, indexHtmlPath);
        if (spaIndex) {
          fileToServe = spaIndex;
          servedRelativePath = 'index.html';
        }
      }
    }

    if (!fileToServe) {
      const hasBuild = (await resolveSafeStaticFile(realDistDir, indexHtmlPath)) !== null;
      if (!hasBuild) {
        res.writeHead(
          503,
          withSecurityHeaders(req, {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-store',
          }),
        );
        res.end('Production build not found in dist/. Run "npm run build" before starting.');
        return;
      }

      res.writeHead(
        404,
        withSecurityHeaders(req, {
          'Content-Type': 'text/plain; charset=utf-8',
        }),
      );
      res.end('Not Found');
      return;
    }

    try {
      const data = await fs.readFile(fileToServe);
      const ext = path.extname(fileToServe).toLowerCase();
      res.writeHead(
        200,
        withSecurityHeaders(req, {
          'Content-Type': getMimeType(fileToServe),
          'Content-Length': data.byteLength,
          'Cache-Control': getCacheControl(servedRelativePath, ext),
        }),
      );
      if (method === 'HEAD') {
        res.end();
      } else {
        res.end(data);
      }
    } catch {
      res.writeHead(
        500,
        withSecurityHeaders(req, {
          'Content-Type': 'text/plain; charset=utf-8',
        }),
      );
      res.end('Internal Server Error');
    }
  });
}

const isExecutedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isExecutedDirectly) {
  const server = createProductionServer();
  server.listen(DEFAULT_PORT, DEFAULT_HOST, () => {
    console.log(`EFER AI server listening on http://${DEFAULT_HOST}:${DEFAULT_PORT}`);
  });
}
