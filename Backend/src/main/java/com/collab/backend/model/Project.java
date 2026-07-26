package com.collab.backend.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Mirrors the Prisma "Project" model, including embedded collaborators/messages.
 * fileTree is stored as Json in Prisma -> represented as a generic Object here.
 */
@Document(collection = "Project")
public class Project {

    @Id
    private String id;

    private String name;
    private String creator;
    private String language;
    private String description;

    private List<Collaborator> collaborators = new ArrayList<>();

    // Prisma: fileTree Json @default("{}") — arbitrary nested structure.
    private Object fileTree = new java.util.LinkedHashMap<>();

    private boolean adminOnlyEdit = false;

    // Prisma maps this to __v (Mongo version key).
    @Field("__v")
    private int version = 0;

    private List<Message> messages = new ArrayList<>();

    private Instant scheduledTime;
    private Instant expiryTime;

    public Project() {
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getCreator() { return creator; }
    public void setCreator(String creator) { this.creator = creator; }

    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public List<Collaborator> getCollaborators() { return collaborators; }
    public void setCollaborators(List<Collaborator> collaborators) { this.collaborators = collaborators; }

    public Object getFileTree() { return fileTree; }
    public void setFileTree(Object fileTree) { this.fileTree = fileTree; }

    public boolean isAdminOnlyEdit() { return adminOnlyEdit; }
    public void setAdminOnlyEdit(boolean adminOnlyEdit) { this.adminOnlyEdit = adminOnlyEdit; }

    public int getVersion() { return version; }
    public void setVersion(int version) { this.version = version; }

    public List<Message> getMessages() { return messages; }
    public void setMessages(List<Message> messages) { this.messages = messages; }

    public Instant getScheduledTime() { return scheduledTime; }
    public void setScheduledTime(Instant scheduledTime) { this.scheduledTime = scheduledTime; }

    public Instant getExpiryTime() { return expiryTime; }
    public void setExpiryTime(Instant expiryTime) { this.expiryTime = expiryTime; }
}
