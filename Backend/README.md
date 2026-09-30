# Collab-AI Backend

The Spring Boot service behind Collab-AI, a real-time collaborative coding platform. It owns
user registration and JWT login, project CRUD, three-tier role-based access control
(`admin` / `readwrite` / `readonly`), expiring share links, project scheduling and expiry
windows, an admin-only edit lock, the persisted file tree and chat history, the STOMP
WebSocket hub that keeps every collaborator's editor and file explorer in sync, and the
Gemini call that turns a chat prompt into a full project scaffold.

## Tech stack

| Concern | Choice |
|---------|--------|
| Framework / language | Spring Boot 3.3, Java 21 |
| REST layer | `spring-boot-starter-web` |
| Persistence | Spring Data MongoDB |
| Token blacklist / cache | Spring Data Redis (Lettuce, TLS-capable) |
| Realtime | Spring WebSocket with STOMP over a simple in-memory broker |
| Request validation | Bean Validation (`spring-boot-starter-validation`) |
| JWT | jjwt 0.12.6 (HS256) |
| Password hashing | Spring Security Crypto (`BCryptPasswordEncoder`) |
| AI codegen | `WebClient` against the Gemini `generateContent` REST endpoint |

## Prerequisites

- **JDK 21**
- **Maven 3.9+**
- A MongoDB database and a Redis instance (local or hosted)

## Run locally

The module lives in the `Backend` directory.

```bash
cd Backend

# Option A: run from source
mvn spring-boot:run

# Option B: build and run the jar
mvn clean package
java -jar target/backend-1.0.0.jar
```

Spring Boot does not read `.env` files on its own, so `run-local.sh` / `run-local.ps1` load
`.env` into the process environment first and then start the app — pass `dev` to go through
`mvn spring-boot:run` instead of the jar:

```bash
./run-local.sh          # jar (builds it if target/backend-1.0.0.jar is missing)
./run-local.sh dev      # mvn spring-boot:run
```

```powershell
.\run-local.ps1
.\run-local.ps1 dev
```

REST and WebSocket both listen on the single `PORT` (default `8080`).

## Environment variables

| Var | Property | Default | Notes |
|-----|----------|---------|-------|
| `PORT` | `server.port` | `8080` | Honours a host-injected port |
| `DATABASE_URL` | `spring.data.mongodb.uri` | `mongodb://localhost:27017/collaborative_coding` | Full MongoDB connection string |
| `SECRET_KEY` | `app.jwt.secret` | dev placeholder | HS256 signing key; tokens expire after 24h |
| `FRONTEND_URL` | `app.cors.frontend-url` | `http://localhost:5173` | Comma-separated for multiple allowed origins; trailing slashes are stripped |
| `REDIS_HOST` | `spring.data.redis.host` | `localhost` | |
| `REDIS_PORT` | `spring.data.redis.port` | `6379` | |
| `REDIS_PASSWORD` | `spring.data.redis.password` | *(empty)* | |
| `REDIS_SSL` | `spring.data.redis.ssl.enabled` | `true` | Set to `false` for a plaintext local Redis; hosted Redis usually requires TLS |
| `GOOGLE_AI_KEY` | `app.gemini.api-key` | *(empty)* | Google AI Studio API key |
| `GEMINI_MODEL` | `app.gemini.model` | `gemini-2.5-flash` | |

## Authentication

`JwtAuthFilter` runs ahead of the controllers and reads the token from the `Authorization`
header as a `Bearer` value, or from a `token` cookie. Every endpoint requires a valid token
except `POST /users/register`, `POST /users/login`, and `GET /`; CORS preflight (`OPTIONS`) passes
through untouched. Logout writes the token into Redis with a 24-hour TTL and the filter
rejects any token present in that blacklist, which is what makes logout effective before the
JWT's own expiry.

## REST endpoints

### `RootController`

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | Health check, returns `hello` |

### `UserController` — `/users`

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/users/register` | Create an account, returns `{ user: { id, email } }` |
| POST | `/users/login` | Returns `{ message, user: { id, email, projects }, token }` |
| GET | `/users/profile` | Current user from the token |
| GET | `/users/logout` | Blacklists the token in Redis |
| GET | `/users/all` | All users except the caller, for the collaborator picker |

### `ProjectController` — `/project`

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/project/create` | Create a project (name, language, description, optional scheduled/expiry times) → 201 |
| GET | `/project/all` | Projects the caller belongs to |
| GET | `/project/get-project/{projectId}` | One project plus the caller's `userAccess` level |
| PUT | `/project/add-user` | Add collaborators at a given access level |
| PUT | `/project/leave-project` | Remove the caller from the project |
| PATCH | `/project/update-collaborator-access` | Change one collaborator's access level |
| POST | `/project/remove-collaborator` | Remove a collaborator |
| PUT | `/project/update-file-tree` | Persist the workspace file tree |
| PATCH | `/project/update/{projectId}` | Update name, language, description, schedule window, admin-only-edit |
| PATCH | `/project/toggle-admin-only-edit/{projectId}` | Flip the admin-only edit lock |
| DELETE | `/project/delete/{projectId}` | Delete the project |
| POST | `/project/share-link` | Mint a share token at an access level, expiring in `expirationDays` (default 7) → 201 |
| GET | `/project/join/{token}` | Redeem a share link and join the project |
| POST | `/project/add-message` | Append a chat message (sender taken from the token) |

### `AiController` — `/ai`

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/ai/get-result?prompt=…` | Gemini completion, returned as `{ result }` |

`AiService` applies a system instruction that constrains the model to a
`{ text, fileTree, buildCommand, startCommand }` JSON shape, strips the Markdown code fences
the model wraps that JSON in, and retries `429` / `503 overloaded` responses with exponential
backoff so a transient provider hiccup does not surface as a failed generation.

## WebSocket API

STOMP over WebSocket, on the **same server port** as the REST API.

- **Endpoint:** `/ws`
- **Broker prefix:** `/topic` (simple in-memory broker)
- **Application destination prefix:** `/app`

The `/ws` endpoint allows all origin patterns. It is not covered by the `FRONTEND_URL` CORS
rules, which apply to the MVC request mappings; the connection is instead gated by the token
check below.

### Handshake

`WebSocketAuthInterceptor` authenticates the STOMP **CONNECT** frame rather than the HTTP
upgrade. The client must send two native headers:

- `Authorization: Bearer <jwt>` (`authorization` is also accepted)
- `projectId: <project id>` (`projectid` is also accepted)

The interceptor verifies the project exists, parses the JWT, and stashes `projectId`, `email`,
and `userId` in the STOMP session attributes — every handler reads the acting user from there
rather than trusting the message payload. A failed CONNECT is rejected with
`MessageDeliveryException("AUTH_FAILED: …")`.

### Destinations

Clients publish to `/app/project/{projectId}/{event}`; the server broadcasts to
`/topic/project/{projectId}/{event}`.

| Client publishes to `…/{event}` | Server broadcasts to | Notes |
|---|---|---|
| `project-message` | `project-message` | A message containing `@AI` / `@ai` is stripped of the mention, sent to Gemini, and the reply is broadcast as `{ message, sender: "AI" }` instead of the original |
| `project-code` | `project-code` | Editor content sync |
| `fileTree-update` | `fileTree-update` | Whole-tree sync |
| `file-created` | `file-created` | Payload re-broadcast with `username` |
| `file-renamed` | `file-renamed` | Payload re-broadcast with `username` |
| `file-deleted` | `file-deleted` | Payload re-broadcast with `username` |
| `files-imported` | `files-imported` | `{ importedItems, username }` |
| `user-cursor-move` | `update-cursor` | `{ userId, username, position }`; ignored when `position` is absent |
| `user-highlight` | `update-highlight` | `{ userId, username, range }`; ignored when `range` is absent |

On session disconnect the server broadcasts `remove-cursor` with `{ userId, username }` to the
project topic so the remaining clients drop that user's cursor. `userId` falls back to the
STOMP session id when the token carries no `userId` claim, which keeps cursor add/remove pairs
matched.

## Deploy

A multi-stage `Dockerfile` is included: a `maven:3.9-eclipse-temurin-21` stage resolves
dependencies (cached on `pom.xml` alone) and packages the jar, then an `eclipse-temurin:21-jre`
runtime stage runs it. The container reads a host-injected `PORT`; REST and WebSocket traffic
share that one port, so a single web service is all that needs to be provisioned.
