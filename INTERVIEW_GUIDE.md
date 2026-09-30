# NexCode / Collab-AI — Complete Interview Guide

> A collaborative, AI-assisted, browser-based coding platform.
> **Frontend:** React 18 + TypeScript + Vite + Tailwind + Redux Toolkit + Monaco + WebContainer
> **Backend:** Java 21 + Spring Boot 3.3 + Spring Data MongoDB + Redis + STOMP WebSocket + Gemini
> **Infra:** MongoDB Atlas, Upstash Redis, Docker (Render), Vercel

---

## 1. The 60-Second Pitch (memorize this)

> "NexCode is a real-time collaborative coding platform — think Google Docs for code, with an AI
> pair-programmer and a runtime built in.
>
> Multiple developers open the same project in a browser, see each other's file-tree and code
> changes stream in live over WebSockets, chat in a side panel, and can type `@ai <prompt>` in that
> chat to have Gemini generate an entire project scaffold — a full file tree with real code —
> straight into the editor. Then they hit **Run**, and the project actually boots *inside the
> browser* using WebContainer (a WASM Node runtime) — `npm install` and `npm start` run client-side,
> and a live preview appears in an iframe. For compiled languages like Java, C++, or Python, we
> route execution to the Judge0 sandbox instead.
>
> On top of that there's a full role-based access system — admin / read-write / read-only —
> expiring share links, project scheduling and expiry windows, and an admin-only lock mode.
>
> The backend is Spring Boot 3.3 on Java 21, laid out controller → service → repository, so every
> authorization decision for the three access tiers lives in the service layer and is re-checked
> server-side on every mutating endpoint. Realtime rides Spring's own STOMP broker — no extra
> server, and the projectId in the topic destination *is* the room boundary."

**If they want it in one line:** *"Real-time collaborative IDE in the browser with an AI code
generator and in-browser execution, on a Spring Boot + MongoDB + WebSocket backend."*

---

## 2. The Problem It Solves

Frame it as **three real pains**, not features:

| Pain | How most people work today | What NexCode does |
|---|---|---|
| **Setup friction kills collaboration.** Onboarding a teammate onto a project means cloning, installing the right Node version, matching dependencies. For a college team or an interview screen, that's an hour lost. | Screen-share + "it works on my machine" | Open a link → the project is already there, already runnable in-browser. **Zero local setup, zero install.** |
| **Pair programming tools don't run code.** Google Docs can't `npm start`. Most collab editors are text-sync only. | Copy-paste code into a local terminal to test | WebContainer boots the project in the browser and shows a **live preview** on real ports. |
| **AI coding help is disconnected from the workspace.** You prompt ChatGPT, get code in a chat window, then manually create every file. | Copy each file out of a chat by hand | `@ai` in the project chat → Gemini returns a **structured file tree** that is merged into the workspace, saved to the DB, broadcast to teammates, and mounted into the runtime — automatically. |

**Target users:** student teams doing group projects, interviewers running live coding rounds,
and anyone teaching/demoing code who doesn't want a setup step.

---

## 3. Architecture at a Glance

```
┌─────────────────────────── BROWSER (React + TS + Vite) ───────────────────────────┐
│                                                                                    │
│  Redux Toolkit (auth)   Monaco Editor   Explorer (file tree)   MessageArea (chat)  │
│         │                     │                 │                     │            │
│         └──────────┬──────────┴─────────────────┴─────────────────────┘            │
│                    │                                                               │
│   ┌────────────────┴──────────────┐        ┌──────────────────────────────┐        │
│   │  axios instance               │        │  @stomp/stompjs client       │        │
│   │  (Bearer token interceptor)   │        │  (JWT + projectId on CONNECT)│        │
│   └────────────────┬──────────────┘        └───────────────┬──────────────┘        │
│                    │                                        │                       │
│   ┌────────────────┴───────────────────────────────────────┴───────────┐           │
│   │  WebContainer (WASM Node runtime, needs COOP/COEP headers)         │           │
│   │  npm install → npm start → server-ready → <iframe> live preview    │           │
│   └───────────────────────────────────────────────────────────────────┘            │
└────────────┬───────────────────────────────────────────────┬───────────────────────┘
             │ HTTPS/REST                                     │ WSS (STOMP over WebSocket)
             ▼                                                ▼
┌─────────────────────────── SPRING BOOT 3.3 / JAVA 21 ────────────────────────────┐
│                                                                                   │
│  JwtAuthFilter (OncePerRequestFilter)      WebSocketAuthInterceptor               │
│    ├─ extract Bearer / cookie token          ├─ validates JWT on STOMP CONNECT    │
│    ├─ Redis blacklist check                  ├─ validates projectId exists        │
│    └─ attach AuthUser to request             └─ stores userId/email in session    │
│              │                                            │                        │
│  ┌───────────┴────────────┬──────────────┐    ┌───────────┴─────────────────┐     │
│  │ UserController         │ AiController │    │ ProjectWebSocketController  │     │
│  │ ProjectController      │              │    │ (SimpleBroker /topic)       │     │
│  └───────────┬────────────┴──────┬───────┘    └───────────┬─────────────────┘     │
│              │                   │                        │                       │
│  ┌───────────┴───────┐  ┌────────┴──────┐                 │                       │
│  │ UserService       │  │ AiService     │◄────────────────┘  (@ai detection)      │
│  │ ProjectService    │  │ (WebClient)   │                                          │
│  └───────────┬───────┘  └────────┬──────┘                                          │
│              │                   │                                                 │
│  MongoRepository + MongoTemplate  └──► Gemini REST (generateContent)                │
│  GlobalExceptionHandler (@RestControllerAdvice)                                     │
└───────┬──────────────────────────────┬──────────────────────────────────────────────┘
        ▼                              ▼
  MongoDB Atlas                  Upstash Redis (TLS)
  user / Project / ShareLink     JWT blacklist (24h TTL)
```

---

## 4. Tech Stack — and *Why* Each Choice (interviewers always ask "why")

| Layer | Choice | Why (say this) |
|---|---|---|
| Backend framework | **Spring Boot 3.3, Java 21** | Type safety, DI, and a mature filter/interceptor model. Records + text blocks (Java 21) kept DTOs and the Gemini prompt clean. |
| Database | **MongoDB (Spring Data)** | The core entity is a **file tree** — arbitrarily nested, schema-free JSON. In SQL that's a recursive join or a serialized blob; in Mongo it's a native document. Collaborators and messages are embedded sub-documents because they're always read *with* the project. |
| Cache | **Redis (Lettuce)** | Stateless JWTs can't be revoked. Logout writes the token to Redis with a 24-hour TTL — exactly the token lifetime — so blacklist entries self-expire and never grow unbounded. |
| Realtime | **STOMP over native WebSocket** | Native to Spring: the broker is registered on `/ws` inside the *same* application — no extra server, no second port, so realtime deploys as one web service. It also gives me topic-based pub/sub out of the box, and putting the `projectId` in the destination makes it the room boundary — no manual room-membership bookkeeping to maintain. |
| Auth | **JWT (HS256, jjwt)** | Stateless — no session store, horizontally scalable. Claims are `{userId, email}`. |
| Passwords | **BCrypt, strength 10** | Salted adaptive hashing — the salt is generated per password and carried inside the hash, so two users with the same password get different hashes and rainbow tables are useless. Strength is the tunable cost factor: 10 is the point where a login stays fast enough to feel instant while brute-forcing a leaked hash stays expensive, and it can be raised as hardware gets cheaper without touching any other code. |
| AI | **Gemini 2.5 Flash via WebClient** | Called the REST endpoint directly instead of the SDK — one less dependency, and I control retries. Flash for latency, since a user is waiting in a chat window. |
| Validation | **Jakarta Bean Validation** | Declarative `@NotBlank` / `@Pattern` on records, so input rules sit on the DTO instead of inside controller bodies; `@RestControllerAdvice` maps every failure into one consistent error JSON shape the frontend can parse in a single code path. |
| Frontend state | **Redux Toolkit** | Only auth is global; project state is local to the page. RTK's `createAsyncThunk` gives me `loading/succeeded/failed` for free, which drives the splash screen and the route guard. |
| Editor | **Monaco** | The VS Code engine — real IntelliSense, themes, multi-model file switching. |
| Runtime | **WebContainer** | Runs Node **in the browser** via WebAssembly. No server-side container to provision, isolate, or pay for — execution cost is the user's own tab. |
| Fallback runtime | **Judge0 (RapidAPI)** | WebContainer is Node-only. Java/C++/Python/Go etc. go to Judge0's sandbox with stdin support. |
| Deploy | **Docker (multi-stage) → Render; Vercel for frontend** | Multi-stage build keeps the runtime image to a JRE. Vercel needed custom COOP/COEP headers (`vercel.json`) for WebContainer to boot. |

---

## 5. THE USER JOURNEY — Complete End-to-End Flow

This is the heart of your explanation. Walk them through it **in order**, and at each step name
the file, the controller, the service, and the query.

---

### STEP 0 — App boots, route guard runs

**Files:** `main.tsx` → `App.tsx` → `Routes/AppRoutes.tsx` → `auth/UserAuth.tsx`

1. `main.tsx` wraps the app in a Redux `<Provider>` and a `<ToastContainer>`.
2. `AppRoutes.tsx` defines the route tree. Public routes: `/login`, `/signup`, `/join/:token`.
   Protected routes are nested inside `<UserAuth />`:

```tsx
<Route path="/join/:token" element={<JoinProject />} />   // public — needs login later
<Route element={<UserAuth />}>                            // guard
  <Route element={<Layout />}>
    <Route path="/home" element={<Home />} />
    <Route path="/project/:id" element={<Project />} />
  </Route>
</Route>
```

3. `UserAuth.tsx` (the guard) does three things:
   - No token in `localStorage` → `navigate("/login")`.
   - Token present but Redux has no user → dispatch `validateToken()`.
   - While `status === "loading"` → render the branded `LoadingScreen` splash.

4. `validateToken()` (in `redux/auth.slice.ts`) is a `createAsyncThunk` that calls
   **`GET /users/profile`**. On success it stores `{id, email}` and sets `isAuthenticated`.
   On failure it clears the token from `localStorage` and sets `status: "failed"`, which makes
   the guard redirect to `/login`.

**Concept to name:** *"This is a stateless-token bootstrap — I don't trust localStorage, I
re-validate the token against the server on every app load."*

---

### STEP 1 — Signup

**Frontend:** `Pages/Signup.tsx` → `POST /users/register { email, password }`

**Backend chain:**

```
UserController.register(@Valid RegisterRequest)
  → validation: AuthDtos.RegisterRequest (@NotBlank / @Email)
  → UserService.createUser(email, password)
      → userRepository.findByEmail(email)        // Mongo: { email: "..." }
      → if present  → ApiException("User already exists", 400)
      → new User(email, BCrypt.encode(password)) // strength 10, salted
      → userRepository.save(user)                // insert into "user" collection
  → 200 { user: { id, email } }                  // password NEVER returned
```

**Points to make:**
- The password is hashed *in the service*, never stored or logged in plain text.
- The response is a hand-built `LinkedHashMap` with only `id` and `email` — I deliberately do
  **not** serialize the `User` entity, so the hash can't leak.
- `email` has `@Indexed(unique = true)` on the model — a DB-level guarantee behind the
  application-level check, so a race between two concurrent signups still can't create duplicates.

---

### STEP 2 — Login and token issue

**Frontend:** `Pages/Login.tsx` → `POST /users/login { email, password }`

**Backend chain:**

```
UserController.login(@Valid LoginRequest)
  → UserService.loginUser(email, password)
      → userRepository.findByEmail(email)
          → empty → ApiException("User does not exist", 404)
      → BCryptPasswordEncoder.matches(raw, storedHash)
          → false → ApiException("Invalid credentials", 401)
      → JwtUtil.generateToken(userId, email)
  → 200 { message, user: { id, email, projects }, token }
```

**`JwtUtil` — the detail worth bragging about:**

```java
this.key = new SecretKeySpec(secret.getBytes(UTF_8), "HmacSHA256");
```

> "jjwt refuses to build a weak HMAC key: `Keys.hmacShaKeyFor()` enforces RFC 7518's **256-bit
> minimum** for HS256 and throws rather than signing with a shorter secret — and because `JwtUtil`
> builds its key in the constructor, that's a hard failure at bean creation, not a runtime warning.
> So I construct the `SecretKey` directly from the configured secret's raw UTF-8 bytes with
> `new SecretKeySpec(..., "HmacSHA256")`, and pin the algorithm explicitly on the way out —
> `signWith(key, Jwts.SIG.HS256)` — instead of letting the library choose it for me.
> **Finding that meant reading the library's key contract, not my own code.** And the caveat I'd
> volunteer before they ask: the real fix is a full-length 256-bit secret in config — the
> hand-built key is what let me run without one, and I know which side of that trade-off I'm on."

**Frontend after login:**
1. `localStorage.setItem("token", token)`
2. `dispatch(validateToken())` — hydrates Redux
3. Redirect logic: if `sessionStorage.pendingJoinToken` exists → go to `/join/:token`
   (that's the deferred share-link flow, Step 8), else `/home`.

---

### STEP 3 — Every authenticated request after this

**`security/JwtAuthFilter.java`** — registered via `config/FilterConfig.java` on
`/users/*`, `/project/*`, `/ai/*`, `/git/*`.

```
1. shouldNotFilter()?
     - OPTIONS (CORS preflight)          → skip
     - /users/register, /users/login, /  → skip (public)
2. extractToken(): "Authorization: Bearer <t>"  OR  cookie named "token"
     - none → 401 { error: "No token Unauthorized user" }
3. redis.hasKey(token)?                 → 401 { error: "redis Unauthorized user" }   (logged out)
4. JwtUtil.parse(token)                 → throws on bad signature / expiry → 401 "Please authenticate"
5. request.setAttribute("authUser", new AuthUser(userId, email))
6. chain.doFilter()
```

Every controller then reads the identity off the request:

```java
AuthUser auth = (AuthUser) request.getAttribute(AuthUser.REQUEST_ATTRIBUTE);
String userId = auth.userId();
```

**Concepts to name:** Servlet filter chain, `OncePerRequestFilter` (guarantees single execution
per request even with internal forwards), stateless authentication, token revocation via a
Redis denylist with TTL == token lifetime.

**Frontend side (`config/axios.tsx`):** a **request interceptor** attaches the token on *every*
call — deliberately read from `localStorage` at request time, not at module load, so a fresh login
in the same tab doesn't send a stale token.

---

### STEP 4 — Home page: list my projects

**Frontend:** `Pages/Home.tsx` → `fetchProjects()` → `GET /project/all`

**Backend chain:**

```
ProjectController.getAll()
  → ProjectService.getAllProjectsByUserId(userId)
      → userRepository.findById(userId)   // guard: user must exist
      → MongoTemplate.find(new Query(
            new Criteria().orOperator(
                Criteria.where("creator").is(userId),
                Criteria.where("collaborators.id").is(userId)   // ← queries INTO embedded array
            )))
      → for each project:
           projectToMap(project, enrich = true)
           + accessLevel   (this user's level, from the collaborators array)
           + expiryTime
  → 200 { projects: [ ... ] }
```

**The query worth explaining:**

> "`collaborators.id` uses Mongo's **dot notation into an embedded array** — it matches if *any*
> element of the array has that id. In SQL this would be a join against a membership table; here
> it's one indexed document read. That's the payoff of embedding collaborators inside the project:
> membership and project data come back in a single round trip."

**`projectToMap` + `enrichCollaborators` — why they exist:**

The `Collaborator` sub-document stores only `{id, accessLevel, addedAt}` — **no email**, because
duplicating emails would mean stale data when a user changes theirs. But the UI needs to *show*
emails. So `enrichCollaborators()` looks each id up in the `user` collection and returns
`{id, email, accessLevel, addedAt}` maps.

> **Be honest and pre-empt this one:** *"That's an N+1 read — one `findById` per collaborator. It's
> fine at our scale (a handful of collaborators per project), but the fix is a single
> `findAllById(ids)` batch query, or a `$lookup` aggregation. I'd do that before scaling."*

**Frontend-side derived state (all in `Home.tsx`):**
- `isProjectAvailable()` — admins always get access; non-admins are blocked if `expiryTime` is
  past or `scheduledTime` is in the future.
- `getProjectStatus()` — returns **Expired** / **Scheduled** / **Active** badges.
- `updateCountdowns()` — a `setInterval` ticking every second renders live countdowns to
  scheduled start (`3d 4h 12m`). Cleaned up in the effect's return — no leaked timer.

---

### STEP 5 — Create a project

**Frontend:** modal in `Home.tsx` → `POST /project/create`

```json
{ "name": "...", "language": "Node", "description": "...",
  "scheduledTime": "2026-08-01T10:00:00.000Z", "expiryTime": "..." }
```

Both time fields are optional and only added to the payload if the user enabled the toggles.

**Backend chain:**

```
ProjectController.create(@Valid CreateProjectRequest)
  → parseInstant(scheduledTime/expiryTime)   // ISO-8601 String → java.time.Instant, null if blank
  → ProjectService.createProject(...)
      → guard: name / userId non-empty
      → MongoTemplate.findOne(Query(where("name").is(name)), Project.class)   // duplicate check
      → new Project:
            creator = userId
            collaborators = [ new Collaborator(userId, "admin") ]   // ← creator is auto-admin
            fileTree = {}   version(__v) = 0   adminOnlyEdit = false
      → projectRepository.save(project)
      → userRepository.findById(userId) → user.projects.add(projectId) → save
  → 201 { project }
```

**Two things to point out:**
1. **The creator is inserted as an admin collaborator at creation time.** That's why every later
   permission check has a simple, uniform shape — I never special-case "the owner isn't in the list".
2. **The relationship is stored on both sides** — `project.collaborators[]` and `user.projects[]`.
   That's intentional denormalization for read speed (a user's project list needs no query into
   projects). The cost is that every membership change must update both — which is exactly what
   `addUserToProject`, `leaveProject`, `removeCollaborator`, and `deleteProject` all do.

---

### STEP 6 — Open a project (the big one)

**Frontend:** card click → `navigate("/project/:id", { state: { project } })` → `Pages/Project.tsx`

On mount, `Project.tsx` fires **three things in parallel** plus a WebSocket connect:

#### 6a. `GET /project/get-project/{projectId}`

```
ProjectController.getProjectById(projectId)
  → ProjectService.getProjectById(projectId, userId)
      → projectRepository.findById(projectId)    // absent → 404 "Project not found"
      → isCreator      = userId == project.creator
      → isCollaborator = collaborators.any(c -> c.id == userId)
      → neither        → ApiException("Access denied", 403)
      → accessLevel = isCreator ? "admin" : <that collaborator's level>
  → 200 {
        project:    { ...enriched... },
        userAccess: { accessLevel, isAdmin, canWrite }
      }
```

> **This is the authorization design worth calling out:** the server doesn't just say yes/no —
> it returns a **capability object**. `canWrite` is computed server-side as
> `accessLevel ∈ {admin, readwrite}`. The frontend uses it to disable the editor and hide buttons,
> but **every mutating endpoint re-checks it server-side**. The UI check is UX; the server check is
> security. *Never* let the interviewer think you trust the client.

#### 6b. `GET /users/all`

Returns every user *except* me — `userRepository.findByIdNot(myId)` → Mongo `{_id: {$ne: myId}}`.
Feeds the "Add Collaborator" picker.

#### 6c. WebSocket connect — `initializeSocket(project.id)`

**Frontend (`config/socket.tsx`):**
```ts
new Client({
  brokerURL: VITE_API_URL.replace(/^http/, "ws") + "/ws",
  connectHeaders: { Authorization: `Bearer ${token}`, projectId },
  reconnectDelay: 5000,
  heartbeatIncoming: 4000, heartbeatOutgoing: 4000,
})
```

**Backend handshake (`socket/WebSocketAuthInterceptor.java`)** — a `ChannelInterceptor` on the
client-inbound channel, firing on `StompCommand.CONNECT`:

```
1. read native headers Authorization + projectId (case-insensitive fallback)
2. missing either → MessageDeliveryException("AUTH_FAILED: ...")
3. projectRepository.findById(projectId) → absent → reject
4. JwtUtil.parse(token) → claims { userId, email }
5. sessionAttributes.put("projectId" / "email" / "userId")
6. accessor.setUser(() -> email)     // Principal for this WS session
```

**Backend broker config (`socket/WebSocketConfig.java`):**
```java
config.enableSimpleBroker("/topic");                 // server → clients
config.setApplicationDestinationPrefixes("/app");    // clients → server
registry.addEndpoint("/ws").setAllowedOriginPatterns("*");
registration.interceptors(authInterceptor);          // auth on inbound
```

So the addressing scheme is:
- **Client publishes to** `/app/project/{projectId}/{event}`
- **Server broadcasts to** `/topic/project/{projectId}/{event}`
- Every client subscribed to that project's topic receives it → **the projectId in the destination
  is the room boundary.**

**Frontend socket abstraction — explain this design:**

`config/socket.tsx` wraps raw STOMP in a small **event-emitter facade**:
- `messageHandlers: Map<eventName, Set<callback>>` — many components can listen to one event
- `activeSubscriptions: Map<eventName, StompSubscription>` — one STOMP subscription per event, no
  duplicates
- `receiveMessage(event, cb)` **returns an unsubscribe function**
- On reconnect, `onConnect` re-subscribes everything in `messageHandlers` automatically

> "I built this because the components shouldn't know about STOMP destinations. They just say
> `receiveMessage("file-created", cb)` and get a cleanup function back — which React's `useEffect`
> can return directly."

#### 6d. The stale-closure problem (a genuinely strong talking point)

`Project.tsx`'s socket `useEffect` has **empty dependencies** — it must register handlers exactly
once. But handlers need the *latest* `fileTree`, `currentFile`, `openFiles`, `webContainer`.
With `[]` deps, they'd close over the **first render's** values forever — an empty file tree and a
null container.

Fix — mirror state into refs:

```tsx
const fileTreeRef = useRef<FileTree>(fileTree);
useEffect(() => { fileTreeRef.current = fileTree; }, [fileTree]);
// handlers then read fileTreeRef.current — always current
```

> "This is the classic React stale-closure trap. The alternatives were re-registering handlers on
> every state change (which stacks duplicate listeners — I actually hit that bug, and it showed up
> as **duplicate toast notifications**) or reducer-style functional updates. Refs were the
> minimal fix: register once, always read fresh."

The effect's cleanup calls every returned unsubscriber — so remounts never stack listeners.

---

### STEP 7 — Add collaborators

**Frontend:** `CollaboratorModal.tsx` → `PUT /project/add-user { projectId, users: [ids], accessLevel }`

**Backend — `ProjectService.addUserToProject`, a layered permission gate:**

```
1. accessLevel defaults to "readonly"
2. projectId / users non-empty                       → else 400
3. userAccessLevel = getUserAccessLevel(me, project)
4. granting a NON-readonly level && I'm not admin    → 403 "Only admins can add users with
                                                             elevated permissions"
5. not admin && !hasWriteAccess(me)                  → 403 "You need at least write access"
6. accessLevel ∉ {admin, readwrite, readonly}        → 400 "Invalid access level"
7. projectRepository.findById(projectId)             → absent → 400
8. userRepository.findAllById(users)                 → any id missing → 400 "Invalid user IDs: ..."
9. any id already in collaborators                   → 400 "Users already added to project: ..."
10. project.adminOnlyEdit && !isAdmin(me)            → 400 "Only admins can add collaborators
                                                             when adminOnlyEdit is enabled"
11. push new Collaborator(id, accessLevel) for each  → projectRepository.save
12. for each added user: user.projects.add(projectId) → save   (both-sides update)
  → 200 { project: enriched }
```

**The three permission helpers (know these cold — they're the security core):**

```java
isAdmin(userId, projectId)
    → userId == project.creator  ||  collaborator.accessLevel == "admin"

getUserAccessLevel(userId, projectId)
    → creator ? "admin" : <collaborator's level>  (null if not a member)

hasWriteAccess(userId, projectId)
    → creator  ||  accessLevel ∈ {"admin", "readwrite"}
```

**The escalation rule to state explicitly:**
> "A read-write collaborator can invite read-only viewers, but **cannot** grant write or admin.
> Only admins can escalate privileges. That prevents lateral privilege escalation — the classic
> flaw where a mid-tier user grants themselves, or a friend, more access than they have."

---

### STEP 8 — Share links (invite people who aren't in your user list yet)

#### 8a. Generate — `POST /project/share-link { projectId, accessLevel, expirationDays }`

```
ProjectService.generateShareLink(...)
  → defaults: accessLevel = "readonly", expirationDays = 7   (DTO: @Min(1) @Max(30))
  → getUserAccessLevel(me) == null              → 400 "You do not have access to this project"
  → non-readonly link && !admin                 → 403 "Only admins can generate share links
                                                        with elevated permissions"
  → readonly link && level ∉ {admin, readwrite} → 403 "You need at least write access"
  → accessLevel ∉ {readwrite, readonly}         → 400   ← admin can never be granted by link
  → token     = UUID.randomUUID()
  → expiresAt = now + expirationDays days
  → shareLinkRepository.save(shareLink)          // "ShareLink" collection, token @Indexed(unique)
  → shareUrl = <first FRONTEND_URL origin, trailing slash stripped> + "/join/" + token
  → 201 { id, token, projectId, accessLevel, createdAt, expiresAt, shareUrl }
```

**Security points:**
- **A share link can never grant `admin`** — hard-capped to readwrite/readonly.
- The token is a **random UUID v4**, not a guessable/sequential id — unguessable capability URL.
- It carries **its own** access level and expiry, independent of the project.
- `FRONTEND_URL` may be a comma-separated multi-origin list; the code takes the first origin and
  normalizes the trailing slash so the URL is always well-formed.

#### 8b. Redeem — `GET /project/join/{token}`

**This is the nicest UX flow in the app** — the deferred-join dance in `component/JoinProject.tsx`:

```
Recipient clicks the link (may not be logged in, may not even have an account)
  → /join/:token is a PUBLIC route
  → not authenticated?
        sessionStorage.setItem("pendingJoinToken", token)
        navigate("/login", { state: { redirectTo: `/join/${token}` } })
        → Login page shows: "Please log in to join the collaborative project"
  → after login, Login.tsx reads pendingJoinToken → navigate back to /join/:token
  → now authenticated → GET /project/join/{token}
```

Backend:
```
ProjectService.joinProjectViaLink(token, userId)
  → shareLinkRepository.findByToken(token)   // absent → 404 "Invalid or expired share link"
  → expiresAt < now                          → 400 "Share link has expired"
  → projectRepository.findById(link.projectId)→ absent → 400
  → userId == project.creator                → 400 "You are already a collaborator"
  → collaborators.add(new Collaborator(userId, link.accessLevel))
  → projectRepository.save
  → user.projects.add(projectId) → save
  → 200 { project, message: "You have successfully joined the project" }
```

Then the UI shows a success card and auto-redirects into the project after 3 seconds.

> **Concept to name:** *"That's an OAuth-style deferred-intent redirect — I preserve the user's
> original destination across an authentication detour, using `sessionStorage` plus router state.
> Without it, a shared link would dump a new user on the login page and lose the invite entirely."*

---

### STEP 9 — Real-time collaborative editing (the core loop)

Two independent sync channels — know the difference:

| Channel | Event | Payload | Purpose |
|---|---|---|---|
| **Code content** | `project-code` | the whole `fileTree` | someone typed in the editor |
| **Tree structure** | `fileTree-update` | the whole `fileTree` | files created/renamed/deleted/moved/imported |

#### Typing in the editor — `component/Monaco.tsx` → `handleInput()`

```
user types
  → guard: !currentFile || !userAccess.canWrite  → return   (read-only users can't edit)
  → clearTimeout(autoSaveTimeoutRef)                        ← DEBOUNCE
  → setTimeout(700ms):
        build FileContent { file: { contents, language: getLanguageFromFilename(path) } }
        updatedTree = setNestedValue(fileTree, path.split("/"), fileData)   ← immutable nested write
        setFileTree(updatedTree)                    // local render
        saveFileTree(updatedTree)                   // PUT /project/update-file-tree  (durable)
        sendMessage("project-code", updatedTree)    // STOMP  (live to teammates)
```

**Why 700ms debounce:** without it, every keystroke would be one HTTP PUT + one broadcast.
That's hundreds of writes a minute per user. The debounce collapses a burst of typing into a
single write — one of the most concrete performance decisions in the project.

**Persistence endpoint:**
```
ProjectController.updateFileTree  →  PUT /project/update-file-tree { projectId, fileTree }
  → ProjectService.updateFileTree(projectId, fileTree, userId)
      → fileTree == null                   → 400 "File tree is required"
      → !hasWriteAccess(userId, projectId) → 403 "You do not have write access"   ← server-side!
      → project.setFileTree(fileTree)
      → project.setVersion(version + 1)    // __v increments on every content save
      → save
```

**Broadcast path:**
```
Client → /app/project/{id}/project-code
  → ProjectWebSocketController.handleProjectCode(projectId, data)
  → messagingTemplate.convertAndSend("/topic/project/{id}/project-code", data)
  → every other client's receiveMessage("project-code") → setFileTree(data)
```

#### Explorer operations — `component/Explorer.tsx`

Create / rename / delete / drag-move / import / export. Each mutation follows the same shape:

```
1. local immutable tree update via updateNodeAtPath(tree, path, node, action)
2. broadcastChanges(updatedTree)
       = sendMessage("fileTree-update", tree)  +  PUT /project/update-file-tree
3. sendMessage("file-created" | "file-renamed" | "file-deleted", { path, type, username })
4. local toast
```

**Why two events per operation?** `fileTree-update` carries the *data* (the new tree).
The `file-created`/`file-renamed`/`file-deleted` events carry the *intent* — so remote clients can
show a precise toast (*"file created at src/index.js by alice@x.com"*) and reconcile their open
tabs (`currentFile`, `openFiles`) instead of just swapping the tree out from under the user.

`Project.tsx` handles those intent events. On a rename it does delete-then-create at the new path,
then remaps `currentFile` and `openFiles` — so a teammate's rename doesn't leave you staring at a
tab pointing at a file that no longer exists.

**Server-side enrichment:** the backend attaches the actor's identity from the *WebSocket session*,
not from the client payload:

```java
String email = (String) headerAccessor.getSessionAttributes().get("email");
response.put("username", email);
```

> That's deliberate — a client could lie about `username` in its payload; the session attribute was
> set from the verified JWT at CONNECT time. **Never trust the client for identity.**

**Import / Export (`Explorer.tsx`):**
- **Import a folder** — `<input webkitdirectory>` → `buildFileTree()` walks
  `file.webkitRelativePath`, reads each file with `FileReader`, produces the nested tree →
  `mergeTrees()` merges it into the existing tree (non-destructive) → save + broadcast
  `files-imported` with the item list, so teammates get *"12 items imported by bob@x.com"*.
- **Export** — `JSZip` walks the tree recursively, rebuilding real folders, then `file-saver`
  triggers `<project-name>.zip`. Round-trips the browser workspace to a real local project.

---

### STEP 10 — Chat

**Frontend:** `component/MessageArea.tsx` → `handleSendMessage()`

Every message does **two** things — and this dual-write is worth explaining:

```ts
sendMessage("project-message", { message, sender: user.email });   // 1. live (STOMP)
await axiosInstance.post("/project/add-message", {                 // 2. durable (Mongo)
  projectId: project.id, message });
```

> "The socket is for *presence* — instant delivery to people currently in the room. The HTTP POST
> is for *persistence* — so someone who joins later still sees the history. Realtime transport and
> durable storage are separate concerns; conflating them means either laggy chat or lost history."

**Backend persistence:**
```
ProjectController.addMessage
  → sender = auth.email()          // from the JWT, NOT from the request body
  → new Message(sender, message)   // createdAt = Instant.now()
  → ProjectService.addMessageToProject(projectId, msg)
      → project.messages.add(msg) → save     // embedded array on the Project document
```

**Backend broadcast:** `ProjectWebSocketController.handleProjectMessage` → re-broadcast to
`/topic/project/{id}/project-message`.

**Frontend receive:** the sender filters out its own echo (`data.sender !== user.email`) since it
already appended optimistically — that's **optimistic UI**: the message appears instantly, before
any server round trip.

**Rendering:** messages are grouped by date, WhatsApp-style bubbles (own messages right-aligned
emerald, others left-aligned white), AI messages rendered through `markdown-to-jsx` with
`react-syntax-highlighter` (Prism, oneDark) for code blocks.

---

### STEP 11 — ⭐ THE FLAGSHIP FEATURE: `@ai` project generation

**This is what you lead with when they ask "what's the best part?"** Walk the full path:

```
① USER types in the project chat:  "@ai create a full-stack todo app with a REST API"
        │
        ▼
② MessageArea.handleSendMessage()
        - detects /@ai\b/i → setIsAiThinking(true)   → animated "generating…" bubble
        - sendMessage("project-message", { message, sender })
        │
        ▼ STOMP /app/project/{id}/project-message
③ ProjectWebSocketController.handleProjectMessage()
        - messageText(data) — defensively extracts .message from Map | byte[] | String | POJO
        - aiMentioned = contains("@AI") || contains("@ai")
        - prompt = message minus the mention, trimmed
        │
        ▼
④ AiService.generateResult(prompt)
        - POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent
        - body: { systemInstruction: { parts:[{ text: GeminiSystemPrompt.INSTRUCTION }] },
                  contents:          [{ parts:[{ text: prompt }] }] }
        - extract candidates[0].content.parts[0].text
        - strip ```json / ``` fences
        - RETRY: on 429 (rate limit) or 503 (overloaded) → up to 3 attempts,
                 exponential backoff 2s → 4s → 8s
        - on final failure → graceful JSON fallback:
              { "text": "I'm sorry, but I'm currently experiencing high demand…", "error": "..." }
          (so the frontend NEVER breaks — it always receives parseable JSON)
        │
        ▼
⑤ Broadcast { message: result, sender: "AI" } → /topic/project/{id}/project-message
        │
        ▼
⑥ Project.tsx handler — THREE-STAGE defensive parse (LLM output is not trustworthy JSON):
        1. JSON.parse(raw)
        2. JSON.parse(raw with ```json fences stripped)
        3. substring from first "{" to last "}" , then parse
        → still failed? log and bail — never throw during render
        │
        ▼
⑦ if (message.fileTree):
        merged = deepMergeTrees(fileTreeRef.current, message.fileTree)   // ← non-destructive!
        setFileTree(merged)                                             // render
        PUT /project/update-file-tree { projectId, fileTree: merged }    // persist
        webContainerRef.current?.mount(merged)                          // load into runtime
        │
        ▼
⑧ User clicks Run → npm install → npm start → live preview in an iframe. Working app.
```

**The system prompt (`service/GeminiSystemPrompt.java`)** — a Java 21 text block that constrains
Gemini to a strict contract:

```json
{
  "text": "explanation for the developer",
  "fileTree": { "name": { "file"|"directory": { "contents": "..." } } },
  "buildCommand": { "mainItem": "npm", "commands": [""] },
  "startCommand": { "mainItem": "", "commands": [""] }
}
```

> **Say this:** *"The critical design decision was making the AI's output shape **identical to the
> file-tree shape WebContainer already mounts**. Gemini's `fileTree` is not translated or
> post-processed — it's the same recursive `{ file: { contents } } | { directory: {...} }` structure
> the editor, the database, and the runtime all speak. One schema, four consumers: LLM → React state
> → MongoDB → WASM runtime. That's why 'prompt → running app' works in one step."*

**Three robustness details to volunteer** — these are what separate a demo from a product:

1. **`deepMergeTrees` (`Project.tsx:70`)** — recursively merges the AI tree *into* the existing
   tree. Directories merge; matching file paths are overwritten; **everything else is preserved.**
   > "Originally I replaced the tree, and a second `@ai` prompt **wiped the user's own files**.
   > That was the worst bug in the project — silent data loss. A recursive non-mutating merge fixed it."

2. **The retry ladder** — Gemini Flash returns 429/503 under load. Three attempts with 2/4/8s
   exponential backoff, and if it still fails, a **valid JSON error object** rather than an
   exception. The frontend has one contract and never crashes.

3. **Never parse during render.** `MessageArea.renderMessageContent` originally called
   `JSON.parse` inline in the render path — one malformed AI reply threw, React unmounted the tree,
   and the whole app went **white screen**. Now every parse is wrapped and falls back to raw text.
   Plus there's a 60-second failsafe timeout so the "generating…" indicator can never spin forever.

**Onboarding touch:** when the chat is empty, `MessageArea` shows a card teaching the `@ai` feature
with three clickable example prompts. *"Discoverability — the best feature is worthless if nobody
knows the syntax."*

---

### STEP 12 — ⭐ RUN: in-browser execution

Two engines, chosen by `project.language`:

#### A. Node projects → **WebContainer** (`runWebContainers()` in `Monaco.tsx`)

```
1. webContainer.mount(fileTree)                       // virtual FS from our tree — no translation
2. findAllPackageJsonDirs(fileTree)                    // ← monorepo detection, see below
3. register webContainer.on("server-ready", (port, url) => ...)
4. for EACH app dir, CONCURRENTLY (Promise.all):
       npm install   → pipe output to console.debug
       exit != 0     → setAppStatus(name, "failed"), CONTINUE with the others
       resolveStartArgs() → picks start | dev | serve from THAT app's package.json
       npm run <script> with env { DISABLE_ESLINT_PLUGIN, ESLINT_NO_DEV_ERRORS, CI: false,
                                   BROWSER: none }
       pipe dev-server output into the Logs pane
5. server-ready fires per port:
       classify Frontend (3000/5173/4173/8080) vs Backend
       collect into serverUrls[]  → dropdown lets the user switch previews
       default preview = the Frontend; else the first server up
       switch UI to the Preview tab
```

**Four engineering problems solved here — each is a great story:**

| Problem | Solution |
|---|---|
| A full-stack app generated by AI has **two** package.json files (client + server). Naive code found the root one and crashed with `Missing script: start`. | `findAllPackageJsonDirs()` recurses **children first**. If sub-apps exist, the root is *skipped* as a container. Only leaf dirs with a `package.json` count as apps. Backend-ish names (`server`/`backend`/`api`) sort first so the API is up before the client that calls it. |
| Vite apps have `dev`, not `start`. CRA has `start`. Some have neither. | `resolveStartArgs()` reads that app's own `package.json` scripts and picks the right one, with a fallback. |
| One app failing killed the whole run. | Each app's install+start is wrapped in its own try/catch inside `Promise.all` — **a broken frontend leaves a working backend usable.** Per-app status chips show `installing → starting → ready / failed`. |
| npm streams thousands of ANSI spinner frames — the log pane froze the tab. | `stripAnsi()` (handles both full CSI sequences *and* WebContainer's bare `[1G`/`[0K` variants), `isNoiseLine()` filters spinners and npm funding/audit chatter, and `MAX_LOG_LINES = 300` caps the buffer. Raw install output goes to `console.debug` for debugging; the UI shows only clean status lines. |

**The infrastructure constraint to mention:** WebContainer needs **cross-origin isolation**.
`vercel.json` sets `Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: require-corp`, and `config/wbContainer.tsx` checks
`crossOriginIsolated` *before* booting so a misconfiguration produces a clear error instead of a
cryptic WASM failure. It also caches the boot promise so concurrent callers don't boot twice, and
clears it on failure so a retry is possible.

> **Why this is architecturally interesting:** *"Normally 'run untrusted user code' means
> provisioning containers, sandboxing, resource limits, and paying per execution. WebContainer moves
> execution into the user's own browser tab — the browser's sandbox **is** the isolation boundary.
> Zero server cost, zero cold start, and no attack surface on my infrastructure."*

#### B. Non-Node languages → **Judge0** (`executeCodeWithJudge0()`)

```
getJudge0LanguageId(language)   // Java 62, Python 71, C++ 54, Go 60, Rust 73, ...
detectInputFunctions(code)      // finds input()/Scanner/cin prompts → modal asks the user for stdin
Java special case: rename `public class Foo` → `public class Main`, submit as Main.java
                   (Judge0 requires the filename to match the public class)
POST judge0-ce.p.rapidapi.com/submissions?wait=true&base64_encoded=false
→ display status / stdout / stderr / compile_output in the Logs pane
```

#### C. Plain JavaScript → sandboxed hidden `<iframe>` with captured `console.log`.

---

### STEP 13 — Admin controls

| Action | Endpoint | Guard | Key rule |
|---|---|---|---|
| Change a collaborator's level | `PATCH /project/update-collaborator-access` | `isAdmin` | **Cannot modify the creator's level** — the owner can never be demoted. |
| Remove a collaborator | `POST /project/remove-collaborator` | `isAdmin` | **Cannot remove the creator.** Also strips `projectId` from that user's `projects[]`. |
| Toggle admin-only lock | `PATCH /project/toggle-admin-only-edit/{id}` | `isAdmin` | Flips `adminOnlyEdit`. While on, only admins can add/remove/modify collaborators. |
| Leave a project | `PUT /project/leave-project` | member | **Cannot leave if you're the only admin** → 403 *"Transfer admin rights first."* Prevents orphaned projects. |
| Update project meta | `PATCH /project/update/{id}` | `hasWriteAccess` | Null-coalescing: absent `name`/`language`/`description` keep their existing values. |
| Delete project | `DELETE /project/delete/{id}` | `isAdmin` | Deletes the doc, **then** `find({projects: {$in: [id]}})` and strips the id from every user's array — no dangling references. |

> **The "only admin" rule is the one to highlight** — it shows you thought about state
> **invariants**, not just happy paths: *"Every project must always have at least one admin.
> Without that guard a project becomes permanently unadministrable — nobody can delete it, invite
> anyone, or change permissions ever again."*

---

### STEP 14 — Logout

```
GET /users/logout
  → extractToken(request)            // header or cookie
  → redis.opsForValue().set(token, "logged out", Duration.ofDays(1))
  → 200 { message: "Logged out" }
```

Then every subsequent request hits `redis.hasKey(token)` in `JwtAuthFilter` → 401.

> **The design insight:** *"JWTs are stateless and can't be un-issued. A denylist reintroduces just
> enough state to revoke them — and the TTL is set to exactly the token lifetime (24h), so entries
> expire on their own the moment the token would have expired anyway. The blacklist can never grow
> unbounded. That's the cheapest possible revocation: O(1) lookup, self-cleaning."*

*(Honest note: the current UI's logout only clears `localStorage` and Redux — the endpoint and
blacklist are implemented server-side but not yet wired to the button. See §10.)*

---

## 6. Complete API Reference (one-page cheat sheet)

### `/users` — `UserController`

| Method | Path | Service | Mongo | Auth | Returns |
|---|---|---|---|---|---|
| POST | `/register` | `createUser` | `findByEmail`, `save` | public | `{ user: {id, email} }` |
| POST | `/login` | `loginUser` | `findByEmail` | public | `{ message, user, token }` |
| GET | `/profile` | — (reads `AuthUser`) | none | JWT | `{ mess: "success", user }` |
| GET | `/logout` | — | Redis `SET` + TTL 24h | JWT | `{ message: "Logged out" }` |
| GET | `/all` | `getAllUsers` | `findByIdNot` → `{_id:{$ne}}` | JWT | `[{id, email}]` |

### `/project` — `ProjectController` (all JWT-protected)

| Method | Path | Service | Guard | Mongo operation |
|---|---|---|---|---|
| POST | `/create` | `createProject` | authenticated | `findOne({name})`, `save`, user `save` |
| GET | `/all` | `getAllProjectsByUserId` | authenticated | `find({$or:[{creator},{collaborators.id}]})` |
| GET | `/get-project/{id}` | `getProjectById` | creator or collaborator | `findById` + per-collaborator `findById` |
| PUT | `/add-user` | `addUserToProject` | admin (elevated) / write (readonly) | `findAllById`, `save` ×N |
| PUT | `/update-file-tree` | `updateFileTree` | `hasWriteAccess` | `findById`, `save` (`__v`++) |
| PATCH | `/update/{id}` | `updateProject` | `hasWriteAccess` | `findById`, `save` |
| DELETE | `/delete/{id}` | `deleteProject` | `isAdmin` | `deleteById` + `find({projects:{$in:[id]}})` cleanup |
| PATCH | `/update-collaborator-access` | `updateCollaboratorAccess` | `isAdmin` | `findById`, `save` |
| POST | `/remove-collaborator` | `removeCollaborator` | `isAdmin` | `findById`, `save`, user `save` |
| PUT | `/leave-project` | `leaveProject` | member, not last admin | `findById`, `save`, user `save` |
| PATCH | `/toggle-admin-only-edit/{id}` | `toggleAdminOnlyEdit` | `isAdmin` | `findById`, `save` |
| POST | `/share-link` | `generateShareLink` | admin (rw) / write (ro) | `ShareLink.save` |
| GET | `/join/{token}` | `joinProjectViaLink` | authenticated | `findByToken`, `save`, user `save` |
| POST | `/add-message` | `addMessageToProject` | authenticated | `findById`, `save` |

### `/ai` — `AiController`
| GET | `/get-result?prompt=` | `AiService.generateResult` | JWT | `{ result }` |

### `/` — `RootController` → `"hello"` (health check, public)

---

## 7. Complete WebSocket Event Reference

Client publishes → `/app/project/{projectId}/{event}` · Server broadcasts → `/topic/project/{projectId}/{event}`

| Event in | Handler | Server does | Event out |
|---|---|---|---|
| `project-message` | `handleProjectMessage` | detects `@AI`/`@ai` → calls `AiService`, else pass-through | `project-message` (sender `"AI"` when AI) |
| `project-code` | `handleProjectCode` | pass-through | `project-code` |
| `fileTree-update` | `handleFileTreeUpdate` | pass-through | `fileTree-update` |
| `file-created` | `handleFileCreated` | + `username` from session | `file-created` |
| `file-renamed` | `handleFileRenamed` | + `username` from session | `file-renamed` |
| `file-deleted` | `handleFileDeleted` | + `username` from session | `file-deleted` |
| `files-imported` | `handleFilesImported` | + `username` from session | `files-imported` |
| `user-cursor-move` | `handleUserCursorMove` | + userId/username from session | `update-cursor` |
| `user-highlight` | `handleUserHighlight` | + userId/username from session | `update-highlight` |
| *(disconnect)* | `@EventListener SessionDisconnectEvent` | reads `projectId` from session attributes | `remove-cursor` |

> **On cursors — be straight about it:** *"The server-side plumbing for live cursor and selection
> sharing is fully built — `user-cursor-move`, `user-highlight`, and a disconnect listener that
> broadcasts `remove-cursor` so a departed user's caret doesn't linger. The Monaco decoration
> rendering on the client is the piece I haven't wired up yet, so it's a designed-and-provisioned
> feature, not a shipped one."* Volunteering this reads as engineering honesty; getting caught
> claiming it reads as bluffing.

---

## 8. Data Model

```
user  (collection: "user")
├─ _id: ObjectId → String
├─ email: String        @Indexed(unique = true)
├─ password: String     BCrypt hash, strength 10
└─ projects: String[]   ← denormalized reverse reference

Project  (collection: "Project")
├─ _id
├─ name, creator (userId), language, description
├─ collaborators: [ Collaborator ]     ← EMBEDDED
│    ├─ id (userId)
│    ├─ accessLevel: "admin" | "readwrite" | "readonly"
│    └─ addedAt: Instant
├─ fileTree: Object                    ← arbitrary nested JSON
│    { "src": { "directory": {
│        "index.js": { "file": { "contents": "...", "language": "javascript" } } } } }
├─ adminOnlyEdit: boolean
├─ __v: int                            @Field("__v") — bumped on every file-tree save
├─ messages: [ Message ]               ← EMBEDDED { sender, message, createdAt }
├─ scheduledTime: Instant              ← project opens at
└─ expiryTime: Instant                 ← project closes at

ShareLink  (collection: "ShareLink")
├─ _id
├─ token: String        @Indexed(unique = true) — UUID v4
├─ projectId, accessLevel ("readwrite" | "readonly")
└─ createdAt, expiresAt
```

**Modelling decisions to defend:**

- **Embed collaborators & messages** — they're always read with the project, never queried
  standalone. One document read, no joins.
- **`fileTree` as a free-form `Object`** — a recursive union type. Mongo stores it natively; SQL
  would need a self-referencing table or a serialized blob. *This single requirement is why the
  project is on MongoDB.*
- **Denormalize `user.projects[]`** — reading "my projects" needs no query into Project. The cost
  is that membership changes write both sides, which every relevant service method does.
- **`__v` as an optimistic-concurrency counter** — currently incremented but not yet *enforced*
  (see §10 for the compare-and-swap upgrade).

---

## 9. Concepts Checklist — "What concepts did you use?"

Have these ready as a rapid-fire list, grouped so you sound structured:

**Backend / Java / Spring**
- Layered architecture: Controller → Service → Repository (thin controllers, business rules in services)
- Dependency injection via **constructor injection** (immutable, testable, no field `@Autowired`)
- Spring Data MongoDB: derived query methods (`findByEmail`, `findByIdNot`, `findByToken`) **and**
  `MongoTemplate` + `Criteria` for dynamic queries (`$or`, `$in`, dot-notation into arrays)
- Servlet filter chain, `OncePerRequestFilter`, `FilterRegistrationBean` with URL patterns and order
- Centralized error handling: `@RestControllerAdvice` + custom `ApiException(message, statusCode)`
- Declarative validation: Jakarta Bean Validation on **Java records** (`@NotBlank`, `@Pattern`, `@Min`/`@Max`)
- Reactive HTTP client: `WebClient` for the Gemini call
- STOMP messaging: `@MessageMapping`, `@DestinationVariable`, `SimpMessagingTemplate`,
  `ChannelInterceptor`, `@EventListener` for lifecycle events
- Java 21 features: **records** (DTOs, `AuthUser`, `LoginResult`), **text blocks** (system prompt),
  pattern matching for `instanceof`, streams throughout
- Externalized config: `application.yml` with `${ENV:default}` + `@Value` injection

**Security**
- JWT (HS256), stateless auth, claims-based identity
- BCrypt password hashing with salt, cost factor 10
- **Token revocation via Redis denylist with TTL** matching token lifetime
- **RBAC** — three roles, capability object (`isAdmin`/`canWrite`) returned to the client but
  re-enforced on every mutating endpoint
- Anti-privilege-escalation rule (you can't grant a level above your own)
- Capability URLs — unguessable UUID share tokens with independent expiry and a hard `admin` cap
- CORS with explicit multi-origin allow-list + credentials
- Identity taken from the **verified session**, never from client payloads

**Realtime**
- WebSocket vs HTTP — when to use each (transport vs. durability)
- Pub/sub topic-per-project as the room boundary
- Authenticated handshake (JWT on STOMP CONNECT)
- Heartbeats + automatic reconnect with subscription replay
- **Debounced** writes (700ms) to collapse keystroke bursts
- Optimistic UI with self-echo filtering
- Dual-write: broadcast for presence + persist for history

**Frontend / React**
- Redux Toolkit slices + `createAsyncThunk` with `pending/fulfilled/rejected` lifecycle
- Protected routes via a nested `<Outlet />` guard component
- Axios **request interceptor** for token injection
- `useEffect` cleanup discipline (unsubscribe functions, `clearTimeout`, `clearInterval`)
- **The stale-closure problem** and the ref-mirror fix
- **Error boundaries** to contain component crashes
- Immutable nested updates (`updateNodeAtPath`, `setNestedValue`, `deepMergeTrees`)
- TypeScript discriminated unions for the recursive file tree
  (`type FileNode = FileContent | DirectoryContent`, narrowed by `"directory" in node`)
- Controlled components, debouncing, portals/modals, drag & drop, `FileReader`, Blob/ZIP generation

**Systems / Infra**
- WASM in-browser runtime; **cross-origin isolation** (COOP/COEP) as a hard prerequisite
- Multi-stage Docker builds (Maven build stage → JRE runtime stage)
- Environment-driven config; host-injected `PORT`
- Exponential-backoff retry for upstream 429/503
- ANSI stream sanitization and bounded log buffers

**AI Engineering**
- Prompt engineering with a strict **output schema** as a system instruction
- **Schema alignment** — LLM output shape == runtime input shape (no adapter layer)
- Defensive multi-stage parsing of untrusted LLM output
- Graceful degradation — always return valid JSON, never an exception
- Non-destructive merge of generated artifacts into user state

---

## 10. Known Limitations & What I'd Do Next
*(Bring 3–4 of these up yourself. Nothing signals seniority faster than knowing your own code's edges.)*

| Limitation | Honest framing + the fix |
|---|---|
| **Last-write-wins on concurrent edits** | "I sync the *whole* file tree, so two people editing the same file simultaneously means the last save wins. `__v` is already incremented on every write — the next step is compare-and-swap on that version to reject stale writes. The real fix for character-level concurrency is a **CRDT** (Yjs / Automerge) or OT, which is what Google Docs and VS Code Live Share use. I scoped that out deliberately: for our usage — teammates working on *different* files — file-level sync was the right cost/benefit. I know exactly what the upgrade path is." |
| **Whole-tree broadcast is O(project size) per save** | "Every save ships the entire tree. Fine for a coursework-sized project, wasteful for a large one. The fix is a **diff/patch payload** — send `{path, contents}` deltas instead of the full tree. Same for persistence: `$set` on `fileTree.src.index_dot_js` rather than replacing the whole document." |
| **WS handshake validates the project exists, not that you're a member** | "`WebSocketAuthInterceptor` verifies the JWT and that the `projectId` is real, but doesn't check membership. So a valid user could subscribe to a project topic they aren't on. The REST layer is properly guarded; the WS layer needs the same `getUserAccessLevel != null` check at CONNECT. **That's the first thing I'd fix** — it's a five-line change in the interceptor." |
| **`add-message` doesn't check membership** | "Same class of gap — any authenticated user can POST a message to any `projectId`. Needs a `getUserAccessLevel != null` guard, which is exactly the pattern already used in `getProjectById`." |
| **Project-name uniqueness is global, not per-creator** | "`createProject` does `findOne({name})` with no `creator` filter, but the error says *'You have already created a project…'*. So one user's name choice blocks everyone's. The query needs `.and("creator").is(userId)`, plus a compound unique index on `(creator, name)`." |
| **N+1 read enriching collaborators** | "One `findById` per collaborator. Batch it with `findAllById(ids)`, or push it into a `$lookup` aggregation." |
| **AI replies aren't persisted** | "User messages are saved via `/add-message`; the AI's reply is only broadcast. So on reload the conversation is one-sided. The fix is to persist the AI message server-side in the same handler that broadcasts it." |
| **Judge0 key is a hardcoded fallback in the bundle** | "There's a literal key as a fallback, and the env read uses `import.meta.env.JUDGE0_API_KEY` — Vite only exposes `VITE_`-prefixed vars, so the fallback is what actually ships. Any client-side key is public anyway; the correct design is to **proxy Judge0 through my backend** so the key stays server-side and I can rate-limit per user." |
| **Hard refresh on `/project/:id` breaks** | "`Project.tsx` initializes from `location.state.project`, so a direct URL visit or refresh has no state. It should fetch by the `:id` route param and treat router state as a fast-path optimization only." |
| **Logout endpoint isn't wired to the UI** | "The Redis blacklist works, but the logout button only clears `localStorage`. One-line fix: `await axiosInstance.get('/users/logout')` before clearing." |
| **Schedule/expiry is enforced client-side only** | "`isProjectAvailable()` runs in the browser. The window should be enforced in `getProjectById` server-side — otherwise the gate is cosmetic." |
| **No automated tests** | "`spring-boot-starter-test` is on the classpath but I didn't write a suite. Priority order if I continued: unit tests on the three permission helpers (`isAdmin`/`hasWriteAccess`/`getUserAccessLevel`) since they're the security core, then `@WebMvcTest` slices per controller, then Testcontainers for Mongo integration tests." |

---

## 11. Hard Problems I Solved (STAR stories — pick 3 for the interview)

### ⭐ Story 1: One schema, four consumers (best architecture story)

- **Situation:** The `@ai` feature has to carry a user's sentence all the way to a running
  application. That path crosses four systems: Gemini's JSON response, React component state, the
  MongoDB `Project` document, and WebContainer's virtual filesystem.
- **Problem:** The obvious design is **four schemas and three translation layers** — parse the LLM
  reply into my own model, map that model into React state, serialize it for Mongo, then build a
  mount descriptor for the runtime. Every one of those adapters is a place where a nested directory
  gets flattened, a `contents` field goes `undefined`, or a file is dropped — and none of it
  throws. It's also four definitions to keep in sync forever: change the tree shape and you edit
  four files and hope you found them all.
- **Action:** I inverted the problem — instead of translating between shapes, I made them the *same*
  shape. `GeminiSystemPrompt.INSTRUCTION` pins the model's output to
  `{ "name": { "file" | "directory": { "contents": ... } } }`, which is exactly the recursive union
  the frontend types as `FileNode = FileContent | DirectoryContent`, exactly what `project.fileTree`
  holds on the document (a free-form nested object — which is precisely why this project is on
  MongoDB), and exactly what `webContainer.mount()` accepts. So the AI handler in `Project.tsx` runs
  `deepMergeTrees` → `setFileTree` → `PUT /project/update-file-tree` → `webContainer.mount(merged)`
  on **one object**, unconverted. No mapper, no intermediate DTO, no adapter to test.
- **Result:** "Prompt → running app" is one step instead of a pipeline. There's no translation layer
  left to corrupt data, and the shape is asserted in a single place — the system instruction — then
  consumed unchanged by three other systems. The realtime path came out free for the same reason:
  the broadcast payload *is* the tree, so a teammate's client can hand it straight to `setFileTree`.
- **Lesson:** *"When one piece of data has to cross several systems, choosing a shape all of them
  speak natively beats any amount of careful mapping code. Adapters aren't just extra work — they're
  where data goes missing quietly."*

### ⭐ Story 2: MongoDB silently rejected every file save

- **Situation:** File saves failed for real projects but worked in my toy tests.
- **Investigation:** Every failing filename had a **dot**: `index.js`, `package.json`,
  `App.tsx`. My `fileTree` is a `Map`, and filenames are **map keys**. Spring Data MongoDB
  forbids `.` in map keys by default — dots are Mongo's path separator, so a key like `index.js`
  is ambiguous with a nested path.
- **Action:** `config/MongoConfig.java` — a `@PostConstruct` hook on the `MappingMongoConverter`:
  ```java
  mappingMongoConverter.setMapKeyDotReplacement("_dot_");
  ```
  Spring now escapes dots on write and un-escapes on read, transparently.
- **Result:** Every filename works. Nothing else in the codebase had to know.
- **Lesson:** *"The bug wasn't in my code — it was in an assumption the framework makes about
  document keys. Reading the mapping layer's contract, not just my own logic, is what found it."*

### ⭐ Story 3: The AI wiped users' files

- **Situation:** A second `@ai` prompt silently **deleted** files the user had written.
- **Diagnosis:** The handler did `setFileTree(message.fileTree)` — a straight **replace**. Anything
  the AI didn't regenerate vanished, then got persisted, so the data was gone for good.
- **Action:** Wrote `deepMergeTrees(base, incoming)` — recursive, non-mutating: directories merge
  branch by branch, matching file paths are overwritten, **everything else is preserved**.
  Only then persist and mount.
- **Result:** AI generations are additive. Users can iterate with multiple prompts safely.
- **Lesson:** *"Silent data loss is the worst class of bug — no error, no crash, the user just finds
  out later. Anything that touches user data should be additive by default and destructive only
  when explicitly asked."*

### Story 4: One malformed AI reply white-screened the entire app

- `MessageArea.renderMessageContent` called `JSON.parse(msg.message)` **during render**. LLMs
  return markdown-fenced JSON, plain prose, or truncated output. One throw inside render →
  React unmounted the tree → blank page.
- Fixed at three layers: (1) `try/catch` around every parse with a raw-text fallback,
  (2) a three-stage parse ladder in `Project.tsx` (direct → strip fences → substring `{...}`),
  (3) `AiService` guaranteeing valid JSON even on total failure — plus an `<ErrorBoundary>` around
  `MessageArea` so a crash there can never take down the workspace.
- **Lesson:** *"Treat LLM output exactly like untrusted user input — validate at every boundary,
  and never let a parse run somewhere a throw is unrecoverable."*

### Story 5: "Missing script: start" on every AI-generated full-stack app

- Gemini generates a monorepo: `client/package.json` + `server/package.json`, and often a root
  `package.json` with no `start` script. My first implementation found the first `package.json`
  and ran `npm start` → instant failure.
- `findAllPackageJsonDirs()` recurses **children first**: if sub-apps exist, the parent is treated
  as a container and skipped; only leaves count. Backend-ish dir names sort first. Then
  `resolveStartArgs()` reads each app's own scripts to pick `start`/`dev`/`serve`, and both apps
  install and boot **concurrently** in independently-failing tasks — a broken client no longer
  takes the API down with it.
- **Lesson:** *"When your input is machine-generated, you can't assume a canonical project layout.
  Discover the structure instead of assuming it."*

### Story 6: Duplicate toasts (the stale-closure/listener bug)

- Every file operation fired 2–5 duplicate notifications, growing over the session.
- Two causes: (1) socket handlers registered inside `useEffect`s with changing deps and **no
  cleanup** — each re-run added another listener to the same event;
  (2) both `Project.tsx` and `Explorer.tsx` subscribed to `file-created`/`renamed`/`deleted`.
- Fixed by making `receiveMessage` **return an unsubscribe function**, registering once with `[]`
  deps + returning cleanup, mirroring state into refs to dodge stale closures, and assigning
  **single ownership** — `Project.tsx` owns `fileTree`, so it alone handles those events; `Explorer`
  only handles `fileTree-update` and `files-imported`.
- **Lesson:** *"Every subscription needs an owner and a cleanup. In React that means the effect that
  creates it must also return the teardown — and only one component should own a given event."*

---

## 12. Rapid-Fire Q&A Prep

**"Why MongoDB over SQL?"**
> The primary entity is a recursively nested file tree of unbounded depth. Mongo stores that as a
> native document; in SQL it's a self-referencing table with recursive CTEs, or a JSON blob that
> gives up all the relational benefits anyway. Collaborators and messages are embedded because
> they're always read with the project — one document read, zero joins. If I needed cross-project
> analytics or strict multi-document transactions, I'd revisit it.

**"How does authentication work end to end?"**
> Login verifies BCrypt, issues an HS256 JWT with `{userId, email}` and 24h expiry. The client
> stores it and an axios interceptor attaches it as a Bearer header on every request.
> `JwtAuthFilter` — a `OncePerRequestFilter` on `/users/*`, `/project/*`, `/ai/*` — extracts the
> token, checks a Redis denylist, verifies the signature, and attaches an `AuthUser` record to the
> request. WebSockets authenticate separately on the STOMP CONNECT frame via a `ChannelInterceptor`,
> and the verified identity is stored in session attributes so every later message is attributed
> from the server side, never from the client payload.

**"How do you handle two people editing the same file?"**
> Right now: last-write-wins on a 700ms debounce, with `__v` incrementing on each save.
> That's a deliberate scope call — my users work on different files, and file-level sync gave me
> real-time collaboration at a fraction of the complexity. I know the upgrade path: enforce `__v`
> as a compare-and-swap to reject stale writes, then move to a CRDT like Yjs for true
> character-level convergence. I'd rather ship a correct simple model than a half-working
> complex one.

**"Is it secure to run user code in the browser?"**
> That's actually the *safest* place for it. WebContainer runs Node compiled to WebAssembly inside
> the browser's existing sandbox — it can't touch the user's filesystem and it can't touch my
> server. Compare that to server-side execution, where I'd need container isolation, resource
> limits, and network egress rules, and a container escape would be *my* breach. Here the blast
> radius is one browser tab. The trade-off is that it needs cross-origin isolation (COOP/COEP
> headers), which I configure in `vercel.json`.

**"What was the hardest bug?"**
> Two candidates, both about assumptions. The MongoDB dot-in-map-keys one — file saves failing for
> any filename containing a period, because Spring Data forbids dots in map keys and every filename
> is a map key. And the AI file-wipe: replacing the tree instead of merging it, which silently
> destroyed user data with no error at all. The first taught me to read the framework's contract;
> the second taught me that anything touching user data should be additive by default.

**"How would you scale this to 10,000 concurrent users?"**
> Four things, in order.
> **(1) The in-memory STOMP broker doesn't scale past one instance** — swap `enableSimpleBroker`
> for a real broker relay (RabbitMQ or Redis pub/sub) so instances share topics.
> **(2) Stop broadcasting the whole tree** — send path-level diffs, and use Mongo `$set` on
> subpaths instead of rewriting the document.
> **(3) Kill the N+1 collaborator reads** with batch queries or `$lookup`, and index `creator` and
> `collaborators.id`.
> **(4) Rate-limit the AI path** — Gemini is the expensive dependency; per-user quotas plus a cache
> for repeated prompts. The auth layer already scales, because JWTs are stateless — any instance
> can serve any request, and the only shared state is the Redis denylist.

**"Why Java and Spring Boot for this rather than something lighter?"**
> Three reasons, all specific to what this app actually is. **First, the permission model is the
> product.** Three access levels, a set of guard helpers — `isAdmin`, `hasWriteAccess`,
> `getUserAccessLevel` — and escalation rules threaded through a dozen service methods. In that code
> a wrong type or a mistyped level isn't a cosmetic bug, it's a security hole; Java refuses to
> compile it. Access levels, DTOs, and the `AuthUser` record are all checked before anything runs.
> **Second, the layering pays for itself.** Controller → service → repository means every
> authorization decision lives in the service layer as an ordinary method taking a userId and a
> projectId — so the security core is testable in isolation, with no HTTP and no database in the way.
> **Third, the extension points are exactly the shape of this problem.** Spring's filter and
> interceptor model let **one** `JwtAuthFilter` cover every REST route through
> `FilterRegistrationBean` URL patterns, and **one** `ChannelInterceptor` cover the entire WebSocket
> handshake on STOMP CONNECT — cross-cutting auth written twice, not per endpoint. And STOMP is
> first-class in Spring, so realtime needed no extra infrastructure at all: same application, same
> port, topic pub/sub included. The honest cost is a heavier runtime and slower startup than a
> minimal framework — which is what the multi-stage Docker build down to a JRE is for.

**"What would you build next?"**
> Three things, in priority order. **Security first:** membership validation on the WebSocket
> handshake and the `add-message` endpoint — both are gaps I know about. **Then the cursor
> feature** — the server side is already built and broadcasting; I'd render remote carets and
> selections as Monaco decorations, which turns "we sync files" into "I can see you working."
> **Then a real test suite**, starting with the three permission helpers, because they're the
> security core and they're pure functions — cheapest, highest-value tests in the codebase.

**"Walk me through what happens when I type a character in the editor."**
> Monaco fires `onChange` → `handleInput` checks `userAccess.canWrite` and bails if you're
> read-only → clears the pending 700ms debounce timer and sets a new one. When it fires:
> `setNestedValue` builds an immutable copy of the tree with your file's new contents and detected
> language → `setFileTree` re-renders → `PUT /project/update-file-tree` persists it (the server
> re-checks `hasWriteAccess` and bumps `__v`) → `sendMessage("project-code")` publishes to
> `/app/project/{id}/project-code` → the STOMP controller rebroadcasts to
> `/topic/project/{id}/project-code` → every other client's handler calls `setFileTree` and their
> editor updates. So: one keystroke burst, one DB write, one broadcast.

---

## 13. Demo Script (5 minutes, if you get to screen-share)

1. **Login** → point out the branded splash while the token is validated against `/users/profile`.
2. **Home** → show the project grid, the Active/Scheduled/Expired badges, and a **live countdown**
   ticking on a scheduled project.
3. **Create a project** → language picker, schedule + expiry toggles. Mention: *creator is
   auto-inserted as an admin collaborator.*
4. **Open the project** → *"the server returned a capability object here — `isAdmin`, `canWrite` —
   and the WebSocket connected with the JWT and projectId on the CONNECT frame."*
5. **⭐ Type `@ai create a full-stack todo app with a REST API`** → the generating indicator, then watch
   **the file tree populate itself**. *"That JSON came back in exactly the shape the editor, the
   database, and the runtime all consume."*
6. **⭐ Hit Run** → per-app status chips (installing → starting → ready), clean logs, then the
   **live preview in the iframe**. *"That's `npm install` and `npm start` running in this tab, in
   WebAssembly. No server touched it."*
7. **Second browser window, logged in as another user** → create a file on one side, watch it
   appear on the other with a toast naming who did it. Type in the editor, watch it sync.
8. **Share link** → generate a read-only 7-day link, show the join flow. *"Note it can never grant
   admin — hard-capped server-side."*
9. **Collaborator modal** → change someone to read-only, show their editor going read-only.
   Toggle **admin-only mode**.
10. **Export** → download the whole workspace as a ZIP. *"Browser workspace out to a real local
    project."*

---

## 14. One-Line Answers to Have Ready

| If asked… | Say |
|---|---|
| Best feature? | `@ai` prompt → full generated project → runs live in the browser, in one flow. |
| Hardest part? | Making a stale-state-free realtime layer with multiple sync channels — and the MongoDB dot-key bug. |
| Biggest lesson? | Silent data loss beats loud crashes for danger; design mutations to be additive. |
| Proudest code? | `deepMergeTrees` + the three-stage LLM parse ladder — small functions that made an unreliable dependency safe. |
| What's the schema alignment idea? | LLM output shape == React state shape == Mongo document shape == WebContainer mount shape. One schema, four consumers, zero adapters. |
| Scale bottleneck? | The in-memory STOMP broker (single instance) and whole-tree broadcasts. |
| Would you use Mongo again? | For a nested file tree, yes, absolutely. For the permission model alone, Postgres would've been fine. |
