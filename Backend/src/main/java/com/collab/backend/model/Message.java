package com.collab.backend.model;

import java.time.Instant;

/**
 * Mirrors the Prisma embedded "type Message":
 *   sender, message, createdAt
 */
public class Message {

    private String sender;
    private String message;
    private Instant createdAt = Instant.now();

    public Message() {
    }

    public Message(String sender, String message) {
        this.sender = sender;
        this.message = message;
        this.createdAt = Instant.now();
    }

    public String getSender() { return sender; }
    public void setSender(String sender) { this.sender = sender; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
