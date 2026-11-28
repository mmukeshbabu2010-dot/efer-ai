# EFER AI

A privacy-first, local-first AI workspace built with React, TypeScript, Tailwind CSS (Palette 027), and a framework-agnostic orchestration core (`src/brain/`).

## Key Capabilities

- **EFER Brain (`src/brain/`)**: Pure TypeScript AI routing layer completely decoupled from React (`ModelRegistry`, `AdapterRegistry`, `ContextManager`, `ErrorNormalizer`, permission-based fallback, and streaming turn execution).
- **Provider Adapters**:
  - **EFER Demo** (`mock-demo`): Built-in deterministic streaming simulator for offline testing and flow verification.
  - **Local Ollama** (`local-ollama`): Connects directly to your local Ollama HTTP runtime (default `http://localhost:11434`, requires Ollama CORS access when running in a browser).
  - **Server Proxy** (`/api/chat`, `server-proxy`): Routes requests through the Node production server (`server.js`) using server-side environment variables (`GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`) without ever storing secrets in the browser.
- **EFER Memory & Privacy Controls**:
  - Add, search, edit, categorize, and delete long-term notes stored in browser `localStorage` (`efer-memory-v1`).
  - Save non-Incognito conversation messages to Memory and pause/resume memory injection per thread (`Remember this chat`).
  - **Incognito Mode**: Strictly isolated in temporary RAM, excluded from normal history, exports, Activity Logs, and EFER Memory reads/writes, and wiped cleanly on exit.
- **Active Workspace Tools**:
  - **Code & Engineering**: Capability routing with copyable fenced code blocks.
  - **Documents & Files**: Local text/code document uploads (up to 100 KB per file, 3 attachments per prompt) and local image/camera previews, scanned client-side for accidental secrets before sending.
  - **Voice Interaction**: Web Speech API microphone dictation and browser `speechSynthesis` Read Aloud playback where supported by the browser.
  - **Exports**: Client-side Markdown (`.md`) and JSON (`.json`) exports for normal conversations (blocked in Incognito).

## Server Environment Variables

To enable live external providers behind `server.js` (`/api/chat` and `/api/health`):

```bash
GEMINI_API_KEY=...
GROQ_API_KEY=...
OPENROUTER_API_KEY=...
```

Keys are read exclusively on the server and are never exposed to client code or browser storage. When an env key is absent, `/api/chat` returns an explicit `503` error rather than simulating live provider responses.

## Scripts

```bash
npm run dev         # Start Vite dev server on port 3000
npm run typecheck   # Run TypeScript type checking
npm run lint        # Run ESLint
npm test            # Run Vitest unit & component tests
npm run build       # Build production bundle into dist/
npm start           # Serve dist/ and /api/* routes via server.js
```