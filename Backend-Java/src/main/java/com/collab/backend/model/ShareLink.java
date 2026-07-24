package com.collab.backend.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Mirrors the Prisma "ShareLink" model:
 *   id, token (unique), projectId, accessLevel (default "readonly"),
 *   createdAt, expiresAt
 */
@Document(collection = "ShareLink")
public class ShareLink {

    @Id
    private String id;

    @Indexed(unique = true)
    private String token;

    private String projectId;
    private String accessLevel = "readonly";
    private Instant createdAt = Instant.now();
    private Instant expiresAt;

    public ShareLink() {
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }

    public String getProjectId() { return projectId; }
    public void setProjectId(String projectId) { this.projectId = projectId; }

    public String getAccessLevel() { return accessLevel; }
    public void setAccessLevel(String accessLevel) { this.accessLevel = accessLevel; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }
}
