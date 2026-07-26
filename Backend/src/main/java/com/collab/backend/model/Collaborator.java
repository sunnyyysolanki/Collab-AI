package com.collab.backend.model;

import java.time.Instant;

/**
 * Mirrors the Prisma embedded "type Collaborator":
 *   id, accessLevel ("admin" | "readwrite" | "readonly"), addedAt
 * Embedded inside Project (not a separate collection).
 */
public class Collaborator {

    private String id;
    private String accessLevel;
    private Instant addedAt = Instant.now();

    public Collaborator() {
    }

    public Collaborator(String id, String accessLevel) {
        this.id = id;
        this.accessLevel = accessLevel;
        this.addedAt = Instant.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getAccessLevel() { return accessLevel; }
    public void setAccessLevel(String accessLevel) { this.accessLevel = accessLevel; }

    public Instant getAddedAt() { return addedAt; }
    public void setAddedAt(Instant addedAt) { this.addedAt = addedAt; }
}
