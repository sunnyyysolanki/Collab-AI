package com.collab.backend.socket;

import com.collab.backend.model.Project;
import com.collab.backend.repository.ProjectRepository;
import com.collab.backend.security.JwtUtil;
import com.collab.backend.service.AiService;
import com.corundumstudio.socketio.AuthorizationResult;
import com.corundumstudio.socketio.HandshakeData;
import com.corundumstudio.socketio.SocketIOClient;
import com.corundumstudio.socketio.SocketIOServer;
import com.corundumstudio.socketio.listener.DataListener;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Claims;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Ports the Socket.IO logic from index.ts.
 *
 * Handshake auth (io.use): requires a valid JWT (auth.token OR
 * Authorization header) and a projectId query param that resolves to a real
 * project. On connect the client joins a room named by projectId; events are
 * re-broadcast to everyone else in that room (socket.broadcast.to(room)).
 *
 * Events: project-message (with @AI handling), project-code, fileTree-update,
 * file-created, file-renamed, file-deleted, files-imported, user-cursor-move,
 * user-highlight, disconnect.
 */
@Component
public class SocketIOHandler {

    private final SocketIOServer server;
    private final JwtUtil jwtUtil;
    private final ProjectRepository projectRepository;
    private final AiService aiService;
    private final ObjectMapper mapper = new ObjectMapper();

    // Per-client stored context.
    private static final String KEY_PROJECT_ID = "projectId";
    private static final String KEY_EMAIL = "email";
    private static final String KEY_USER_ID = "userId";

    public SocketIOHandler(SocketIOServer server, JwtUtil jwtUtil,
                           ProjectRepository projectRepository, AiService aiService) {
        this.server = server;
        this.jwtUtil = jwtUtil;
        this.projectRepository = projectRepository;
        this.aiService = aiService;
    }

    @PostConstruct
    public void start() {
        // ---- Handshake auth (equivalent to io.use(...)) ----
        // In netty-socketio the AuthorizationListener lives on Configuration.
        server.getConfiguration().setAuthorizationListener(data -> {
            try {
                String token = extractToken(data);
                String projectId = data.getSingleUrlParam("projectId");
                if (projectId == null || projectId.isBlank()) {
                    return AuthorizationResult.FAILED_AUTHORIZATION;
                }
                if (token == null || token.isBlank()) {
                    return AuthorizationResult.FAILED_AUTHORIZATION;
                }
                Optional<Project> project = projectRepository.findById(projectId);
                if (project.isEmpty()) {
                    return AuthorizationResult.FAILED_AUTHORIZATION;
                }
                jwtUtil.parse(token); // throws if invalid
                return AuthorizationResult.SUCCESSFUL_AUTHORIZATION;
            } catch (Exception e) {
                return AuthorizationResult.FAILED_AUTHORIZATION;
            }
        });

        // ---- Connect: join room, stash user context ----
        server.addConnectListener(client -> {
            HandshakeData data = client.getHandshakeData();
            String projectId = data.getSingleUrlParam("projectId");
            String token = extractToken(data);
            Claims claims = jwtUtil.parse(token);

            client.set(KEY_PROJECT_ID, projectId);
            client.set(KEY_EMAIL, claims.get("email", String.class));
            client.set(KEY_USER_ID, claims.get("userId", String.class));

            client.joinRoom(projectId);
            System.out.println("a user connected: " + projectId);
        });

        // ---- project-message (with @AI) ----
        server.addEventListener("project-message", Object.class, (client, data, ack) -> {
            String projectId = client.get(KEY_PROJECT_ID);
            String message = messageText(data);

            boolean aiMentioned = message != null &&
                    (message.contains("@AI") || message.contains("@ai"));

            if (aiMentioned) {
                String prompt = message.replace("@AI", "").replace("@ai", "").trim();
                String result = aiService.generateResult(prompt);
                // Emit to EVERYONE in the room (Node uses io.to(room) for AI).
                server.getRoomOperations(projectId).sendEvent("project-message",
                        Map.of("message", result, "sender", "AI"));
                return;
            }

            broadcast(client, projectId, "project-message", data);
        });

        // ---- Simple relays (broadcast to others in room) ----
        relay("project-code");
        relay("fileTree-update");
        relay("files-imported", "importedItems");

        // ---- file events: server stamps username from the JWT ----
        server.addEventListener("file-renamed", Map.class, (client, data, ack) ->
                emitToOthers(client, "file-renamed", Map.of(
                        "oldPath", data.get("oldPath"),
                        "newPath", data.get("newPath"),
                        "username", client.get(KEY_EMAIL)
                )));

        server.addEventListener("file-created", Map.class, (client, data, ack) ->
                emitToOthers(client, "file-created", Map.of(
                        "path", data.get("path"),
                        "type", data.get("type"),
                        "username", client.get(KEY_EMAIL)
                )));

        server.addEventListener("file-deleted", Map.class, (client, data, ack) ->
                emitToOthers(client, "file-deleted", Map.of(
                        "path", data.get("path"),
                        "username", client.get(KEY_EMAIL)
                )));

        // ---- cursor / highlight (use userId from JWT, fallback to session id) ----
        server.addEventListener("user-cursor-move", Map.class, (client, data, ack) -> {
            if (data == null || data.get("position") == null) return;
            emitToOthers(client, "update-cursor", Map.of(
                    "userId", userIdOrSession(client),
                    "username", client.get(KEY_EMAIL),
                    "position", data.get("position")
            ));
        });

        server.addEventListener("user-highlight", Map.class, (client, data, ack) -> {
            if (data == null || data.get("range") == null) return;
            emitToOthers(client, "update-highlight", Map.of(
                    "userId", userIdOrSession(client),
                    "username", client.get(KEY_EMAIL),
                    "range", data.get("range")
            ));
        });

        // ---- disconnect: remove cursor, leave room ----
        server.addDisconnectListener(client -> {
            String projectId = client.get(KEY_PROJECT_ID);
            if (projectId != null) {
                emitToOthers(client, "remove-cursor", Map.of(
                        "userId", userIdOrSession(client),
                        "username", client.get(KEY_EMAIL) == null ? "" : client.get(KEY_EMAIL)
                ));
                client.leaveRoom(projectId);
            }
            System.out.println("a user disconnected");
        });

        server.start();
        System.out.println("Socket.IO server started");
    }

    @PreDestroy
    public void stop() {
        server.stop();
    }

    // ----- helpers -----

    private void relay(String event) {
        server.addEventListener(event, Object.class, (client, data, ack) ->
                broadcast(client, client.get(KEY_PROJECT_ID), event, data));
    }

    /** Relay that also stamps username (for files-imported). */
    private void relay(String event, String payloadKey) {
        server.addEventListener(event, Map.class, (client, data, ack) ->
                emitToOthers(client, event, Map.of(
                        payloadKey, data.get(payloadKey),
                        "username", client.get(KEY_EMAIL)
                )));
    }

    private void broadcast(SocketIOClient client, String room, String event, Object data) {
        for (SocketIOClient other : server.getRoomOperations(room).getClients()) {
            if (!other.getSessionId().equals(client.getSessionId())) {
                other.sendEvent(event, data);
            }
        }
    }

    private void emitToOthers(SocketIOClient client, String event, Object data) {
        String room = client.get(KEY_PROJECT_ID);
        if (room == null) return;
        broadcast(client, room, event, data);
    }

    private String userIdOrSession(SocketIOClient client) {
        String userId = client.get(KEY_USER_ID);
        return userId != null ? userId : client.getSessionId().toString();
    }

    private String extractToken(HandshakeData data) {
        // socket.io-client sends auth.token; also accept Authorization header.
        Object authToken = data.getAuthToken();
        if (authToken instanceof Map<?, ?> m && m.get("token") != null) {
            return m.get("token").toString();
        }
        List<String> auth = data.getHttpHeaders() == null ? null
                : data.getHttpHeaders().getAll("Authorization");
        if (auth != null && !auth.isEmpty()) {
            String h = auth.get(0);
            if (h.startsWith("Bearer ")) return h.substring(7);
        }
        return null;
    }

    private String messageText(Object data) {
        try {
            if (data instanceof Map<?, ?> m && m.get("message") != null) {
                return m.get("message").toString();
            }
            var node = mapper.valueToTree(data);
            return node.path("message").asText(null);
        } catch (Exception e) {
            return null;
        }
    }
}
