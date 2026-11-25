# EFER AI

**Enhanced · Flexible · Extensible · Reasoning AI**

EFER AI is a personal-first AI workspace being developed in public. The long-term goal is to bring multiple AI providers, local models, memory, and creative tools into one interface while keeping the user in control of data sharing and automation.

> This repository is at the foundation-preview stage. The current interface is a frontend scaffold, not a connected AI assistant. No provider API calls are implemented yet.

## Current status

- [x] React + TypeScript + Vite foundation
- [x] Responsive first interface
- [x] Honest provider-connection status
- [x] Settings preview for BYOK and built-in connection plans
- [ ] Secure provider connection
- [ ] Real chat requests and streaming
- [ ] Conversation persistence
- [ ] Permission-based provider fallback
- [ ] Local model support
- [ ] Image, voice, and video tools

## Technology

- React for the user interface
- TypeScript for typed application code
- Vite for local development and production builds
- Lucide React for icons
- CSS for the initial responsive design

## Run locally

You need a recent Node.js LTS release and npm.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

Check the production build:

```bash
npm run build
npm run preview
```

## Connection strategy

EFER AI is planned to support two connection paths:

1. **Bring Your Own Key (BYOK):** users connect their own provider accounts. Browser storage is not a secure vault; key handling and a safer backend/proxy design must be implemented before asking users to enter real keys.
2. **Built-in AI:** EFER-managed provider credentials must stay on a trusted backend. They must never be embedded in frontend code or committed to this repository.

Provider adapters will keep provider-specific request and response formats separate from the application interface.

## Development principles

- Start personal-first; defer public accounts, billing, and multi-user administration.
- Do not commit API keys, tokens, or private credentials.
- Do not silently send prompts or conversation data to an unapproved provider.
- Make fallback behavior visible and permission-based.
- Clearly label unfinished features; never present mock output as a real model response.
- Test changes and report what has and has not been verified.

## Roadmap

1. Foundation and first real chat connection
2. Provider adapters and model capability registry
3. Permission-based fallback
4. User-controlled memory and local history
5. Local model connections
6. Image, voice, coding, and video capabilities
7. Security review, responsive testing, and deployment

## Project status

Early development. Interfaces, architecture, and roadmap may evolve as working features are implemented.
