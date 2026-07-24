# Collab-AI Backend — Java Spring Boot port

A drop-in replacement for the Node/Express backend, built with Spring Boot 3.3 / Java 21.
The React frontend is **untouched** — this backend reproduces the same REST endpoints,
JSON shapes, JWT (interchangeable tokens), and Socket.IO events.

## Stack mapping (Node → Spring Boot)

| Node | Spring Boot |
|------|-------------|
| express | spring-boot-starter-web |
| prisma + mongodb | spring-boot-starter-data-mongodb |
| ioredis | spring-boot-starter-data-redis (Lettuce, TLS for Upstash) |
| jsonwebtoken | jjwt (HS256, same secret & claims) |
| bcrypt | spring-security-crypto (hash-compatible) |
| express-validator | spring-boot-starter-validation |
| @google/generative-ai | WebClient → Gemini REST API |
| socket.io | netty-socketio (client connects unchanged) |
| simple-git | JGit (git routes are disabled in Node; not wired here) |

## Run locally

Requires **JDK 21** and **Maven**.

```bash
cd Backend-Java

# set env (or use a .env-style export / your IDE run config)
export DATABASE_URL="mongodb+srv://.../collaborative_coding?retryWrites=true&w=majority"
export SECRET_KEY="<same value as the Node backend>"
export FRONTEND_URL="http://localhost:5173"
export REDIS_HOST="...upstash.io"
export REDIS_PORT="6379"
export REDIS_PASSWORD="..."
export GOOGLE_AI_KEY="..."
export GEMINI_MODEL="gemini-2.5-flash"

mvn spring-boot:run
```

- REST API runs on `PORT` (default 8080).
- Socket.IO runs on `SOCKETIO_PORT` (default 9092) — see note below.

## ⚠️ Important: two ports

Unlike the Node backend (Express + Socket.IO share **one** HTTP server), netty-socketio
runs its **own** server on a separate port. Two options:

1. **Local dev:** point the frontend socket at `http://localhost:9092` (set `SOCKETIO_PORT`
   and update `VITE_API_URL` for the socket, or run a small reverse proxy).
2. **Production:** put both behind a reverse proxy that routes `/socket.io/` to 9092 and
   everything else to 8080 — OR set `SOCKETIO_PORT` = the same as your platform's port if
   the platform allows it. On Render, the simplest path is a reverse proxy or a second service.

> This is the one place the "frontend untouched" goal needs care — the frontend's
> `VITE_API_URL` is used for BOTH REST and socket. If REST and socket are on different
> ports/hosts, the socket URL must be configured to reach 9092.

## Environment variables

| Var | Maps to | Notes |
|-----|---------|-------|
| `DATABASE_URL` | `spring.data.mongodb.uri` | **MongoDB** (same Atlas cluster as Node) |
| `SECRET_KEY` | `app.jwt.secret` | **Must match Node** so JWTs are interchangeable |
| `FRONTEND_URL` | `app.cors.frontend-url` | Comma-separated multi-origin, like Node |
| `REDIS_HOST/PORT/PASSWORD` | `spring.data.redis.*` | TLS on by default (`REDIS_SSL`) for Upstash |
| `GOOGLE_AI_KEY` | `app.gemini.api-key` | Gemini key |
| `GEMINI_MODEL` | `app.gemini.model` | default `gemini-2.5-flash` |
| `PORT` | `server.port` | host-injected (Render) |
| `SOCKETIO_PORT` | `app.socketio.port` | default 9092 |

## Deploy (Render, Docker)

A `Dockerfile` is included (multi-stage, Java 21). On Render: create a **Web Service**,
set env vars above, and it builds/runs the image. Expose the REST port; handle the
socket port per the note above.

## Endpoints (all match the Node backend)

- **/users**: `POST /register`, `POST /login`, `GET /profile`, `GET /logout`, `GET /all`
- **/project**: `create`, `all`, `add-user`, `leave-project`, `update-collaborator-access`,
  `get-project/{id}`, `update-file-tree`, `delete/{id}`, `update/{id}`, `share-link`,
  `join/{token}`, `remove-collaborator`, `toggle-admin-only-edit/{id}`, `add-message`
- **/ai**: `GET /get-result?prompt=...`
- **Socket.IO events**: project-message (+@AI), project-code, fileTree-update,
  file-created, file-renamed, file-deleted, files-imported, user-cursor-move,
  user-highlight, disconnect

## ⚠️ Not yet verified

This port was written without a local JDK to compile against. Before deploying:

```bash
mvn clean compile   # fix any import/type errors
mvn clean package    # produce the jar
```

Things most likely to need a tweak on first compile: netty-socketio API method names
(`getRoomOperations`, `AuthorizationResult`, `HandshakeData.getAuthToken`) can vary
slightly by version (pinned to 2.0.12), and WebClient error message parsing for retries.
