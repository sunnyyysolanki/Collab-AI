# Collab-AI

A real-time collaborative coding platform. Several people open the same project and get one
shared workspace: the file tree and the open file's contents are synced over WebSockets as they
type, with a chat panel alongside the editor. Typing `@ai` in
that chat hands the prompt to Gemini, which answers with a complete project scaffold — a whole
file tree plus build and start commands — that is written straight into the workspace. The
result can then be run without leaving the browser.

## Features

- **Live collaboration** — file-tree and code sync over a STOMP WebSocket connection, scoped to
  one topic per project. File create/rename/delete events are attributed to the user who made
  them, using the identity from the authenticated WebSocket session rather than the client
  payload. (Cursor and selection sharing is broadcast by the server but not yet rendered by the
  client — see the note below.)
- **Project chat with an AI participant** — an `@ai` message is routed to Gemini, which is
  constrained to return `{ text, fileTree, buildCommand, startCommand }` so its reply can be
  materialised as real files rather than pasted as prose.
- **Three-tier role-based access** — `admin`, `readwrite`, and `readonly`. Access level is
  resolved server-side per request and returned with the project, so the UI and the API agree
  on what a user may do.
- **Expiring share links** — an admin mints a tokenised invite at a chosen access level with a
  lifetime in days (7 by default); redeeming it joins the project.
- **Scheduling and expiry windows** — a project can carry a scheduled start and an expiry time.
- **Admin-only edit lock** — a single toggle that restricts collaborator changes to admins.
- **Import and export** — bring a folder in or take the workspace out as a ZIP; imports are
  broadcast to everyone already in the session.
- **Run it in the browser** — Node projects boot in a WebContainer, which runs the install and
  start commands in-browser and exposes the dev server in a preview pane with streamed terminal
  logs; plain JavaScript runs in a hidden iframe; other languages are compiled and executed
  through the Judge0 CE API.

## Not yet wired up

The WebSocket layer already broadcasts `user-cursor-move` and `user-highlight`, and cleans up a
departed user's caret on disconnect (`ProjectWebSocketController`). The Monaco decorations that
would draw remote carets and selections are not implemented on the client yet, so cursor sharing
is server-side plumbing rather than a shipped feature.

## Repo layout

```
Frontend/   React 18 + TypeScript + Vite + Tailwind CSS + Redux Toolkit + Monaco Editor
Backend/    Spring Boot 3.3 + Java 21 + MongoDB + Redis + STOMP WebSocket
```

## Getting started

**Backend** — prerequisites, run commands, the full environment variable table, and the REST and
WebSocket reference are in [`Backend/README.md`](Backend/README.md).

**Frontend** — requires Node 18+ and npm:

```bash
cd Frontend
npm install
npm run dev        # Vite dev server on http://localhost:5173
npm run build      # type-check + production build
```

Environment variables, by name — values belong in a local `.env`, never in the repo:

- **Frontend:** `VITE_API_URL` (base URL of the backend; must point at the port the backend
  actually serves)
- **Backend:** `PORT`, `DATABASE_URL`, `SECRET_KEY`, `FRONTEND_URL`, `REDIS_HOST`,
  `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_SSL`, `GOOGLE_AI_KEY`, `GEMINI_MODEL`

`FRONTEND_URL` on the backend gates CORS and accepts a comma-separated list, so it has to
include whatever origin the frontend is actually served from.

## Deploy gotcha: cross-origin isolation

WebContainer needs `SharedArrayBuffer`, which browsers only expose on a **cross-origin
isolated** page. The frontend therefore has to be served with:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Both are set in [`Frontend/vercel.json`](Frontend/vercel.json). Without them the app loads
normally and then fails only when someone hits Run, which makes this easy to miss — any host
or reverse proxy other than that Vercel config must send the same two headers. Note that
`require-corp` also means cross-origin subresources need to opt in via CORS or CORP.
