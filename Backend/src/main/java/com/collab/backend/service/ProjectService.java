package com.collab.backend.service;

import com.collab.backend.exception.ApiException;
import com.collab.backend.model.Collaborator;
import com.collab.backend.model.Message;
import com.collab.backend.model.Project;
import com.collab.backend.model.ShareLink;
import com.collab.backend.model.User;
import com.collab.backend.repository.ProjectRepository;
import com.collab.backend.repository.ShareLinkRepository;
import com.collab.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Ports project.service.ts faithfully.
 *
 * Collaborator enrichment (attaching each collaborator's email from the user
 * collection) is done by returning projects as LinkedHashMap structures, since
 * the Collaborator model has no email field and must not be modified. The map
 * shape mirrors the JSON the Node service returns (frontend depends on it).
 */
@Service
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final UserRepository userRepository;
    private final ShareLinkRepository shareLinkRepository;
    private final MongoTemplate mongoTemplate;

    private final String frontendUrl;

    public ProjectService(ProjectRepository projectRepository,
                          UserRepository userRepository,
                          ShareLinkRepository shareLinkRepository,
                          MongoTemplate mongoTemplate,
                          @Value("${app.cors.frontend-url}") String frontendUrl) {
        this.projectRepository = projectRepository;
        this.userRepository = userRepository;
        this.shareLinkRepository = shareLinkRepository;
        this.mongoTemplate = mongoTemplate;
        this.frontendUrl = frontendUrl;
    }

    // ------------------------------------------------------------------
    // Access-level helpers
    // ------------------------------------------------------------------

    /** isAdmin(userId, projectId): creator OR collaborator with accessLevel == admin. */
    public boolean isAdmin(String userId, String projectId) {
        Project project = projectRepository.findById(projectId).orElse(null);
        if (project == null) return false;

        if (userId.equals(project.getCreator())) return true;

        return project.getCollaborators().stream()
                .anyMatch(c -> userId.equals(c.getId()) && "admin".equals(c.getAccessLevel()));
    }

    /** getUserAccessLevel(userId, projectId): "admin" for creator, else collaborator level or null. */
    public String getUserAccessLevel(String userId, String projectId) {
        Project project = projectRepository.findById(projectId).orElse(null);
        if (project == null) return null;

        if (userId.equals(project.getCreator())) return "admin";

        return project.getCollaborators().stream()
                .filter(c -> userId.equals(c.getId()))
                .map(Collaborator::getAccessLevel)
                .findFirst()
                .orElse(null);
    }

    /** hasWriteAccess(userId, projectId): creator OR collaborator with admin/readwrite. */
    public boolean hasWriteAccess(String userId, String projectId) {
        Project project = projectRepository.findById(projectId).orElse(null);
        if (project == null) return false;

        if (userId.equals(project.getCreator())) return true;

        Collaborator collaborator = project.getCollaborators().stream()
                .filter(c -> userId.equals(c.getId()))
                .findFirst()
                .orElse(null);

        if (collaborator == null) return false;

        return "admin".equals(collaborator.getAccessLevel())
                || "readwrite".equals(collaborator.getAccessLevel());
    }

    // ------------------------------------------------------------------
    // createProject
    // ------------------------------------------------------------------

    public Project createProject(String name,
                                 String userId,
                                 String language,
                                 String description,
                                 Instant scheduledTime,
                                 Instant expiryTime) {
        // Node createProjectController catches ALL errors as 500 (message passed
        // through), so createProject failures carry status 500 to match.
        if (name == null || name.isEmpty()) throw new ApiException("Project name is required", 500);
        if (userId == null || userId.isEmpty()) throw new ApiException("User ID is required", 500);

        // Check for existing project with the same name (Prisma findFirst on name).
        Query q = new Query(Criteria.where("name").is(name));
        Project existing = mongoTemplate.findOne(q, Project.class);
        if (existing != null) {
            throw new ApiException("You have already created a project with this name", 500);
        }

        Project project = new Project();
        project.setName(name);
        project.setLanguage(language);
        project.setDescription(description);
        project.setCreator(userId);

        List<Collaborator> collaborators = new ArrayList<>();
        Collaborator creatorCollab = new Collaborator(userId, "admin");
        collaborators.add(creatorCollab);
        project.setCollaborators(collaborators);

        project.setScheduledTime(scheduledTime);
        project.setExpiryTime(expiryTime);

        Project saved = projectRepository.save(project);

        // Add project to user's projects (Prisma push).
        User user = userRepository.findById(userId).orElse(null);
        if (user != null) {
            user.getProjects().add(saved.getId());
            userRepository.save(user);
        }

        return saved;
    }

    // ------------------------------------------------------------------
    // getAllProjectsByUserId
    // ------------------------------------------------------------------

    public List<Map<String, Object>> getAllProjectsByUserId(String userId) {
        // Node getAllProjectController catches ALL errors as 500 (message passed
        // through), so these carry status 500 to match.
        if (userId == null || userId.isEmpty()) throw new ApiException("User ID is required", 500);

        User user = userRepository.findById(userId).orElse(null);
        if (user == null) throw new ApiException("User not found", 500);

        // Prisma: creator == userId OR collaborators.some(id == userId)
        Criteria criteria = new Criteria().orOperator(
                Criteria.where("creator").is(userId),
                Criteria.where("collaborators.id").is(userId)
        );
        List<Project> projects = mongoTemplate.find(new Query(criteria), Project.class);

        List<Map<String, Object>> result = new ArrayList<>();
        for (Project project : projects) {
            Map<String, Object> projectMap = projectToMap(project, true);

            // accessLevel of the current user (from enriched collaborators).
            String accessLevel = project.getCollaborators().stream()
                    .filter(c -> userId.equals(c.getId()))
                    .map(Collaborator::getAccessLevel)
                    .findFirst()
                    .orElse(null);

            projectMap.put("accessLevel", accessLevel);
            projectMap.put("expiryTime", project.getExpiryTime());

            result.add(projectMap);
        }

        return result;
    }

    // ------------------------------------------------------------------
    // addUserToProject
    // ------------------------------------------------------------------

    public Map<String, Object> addUserToProject(String projectId,
                                                String userId,
                                                List<String> users,
                                                String accessLevel) {
        if (accessLevel == null) accessLevel = "readonly";
        if (projectId == null || projectId.isEmpty()) throw new ApiException("Project ID is required", 400);
        if (users == null || users.isEmpty()) throw new ApiException("Users are required", 400);

        String userAccessLevel = getUserAccessLevel(userId, projectId);

        // Only admins can add users with admin or readwrite access.
        if (!"readonly".equals(accessLevel) && !"admin".equals(userAccessLevel)) {
            throw new ApiException("Only admins can add users with elevated permissions", 403);
        }

        // Non-admins need at least write access to add readonly collaborators.
        if (!"admin".equals(userAccessLevel) && !hasWriteAccess(userId, projectId)) {
            throw new ApiException("You need at least write access to add collaborators", 403);
        }

        if (!("admin".equals(accessLevel) || "readwrite".equals(accessLevel) || "readonly".equals(accessLevel))) {
            throw new ApiException("Invalid access level", 400);
        }

        Project validProject = projectRepository.findById(projectId).orElse(null);
        if (validProject == null) {
            throw new ApiException("Invalid Project Id", 400);
        }

        User validUser = userRepository.findById(userId).orElse(null);
        if (validUser == null) throw new ApiException("Invalid user ID: " + userId, 400);

        // Validate all user IDs in the users array.
        List<User> validUsers = userRepository.findAllById(users);
        List<String> validUserIds = validUsers.stream().map(User::getId).toList();
        List<String> invalidUserIds = users.stream()
                .filter(id -> !validUserIds.contains(id))
                .toList();
        if (!invalidUserIds.isEmpty()) {
            throw new ApiException("Invalid user IDs: " + String.join(", ", invalidUserIds), 400);
        }

        List<String> existingUserIds = validProject.getCollaborators().stream()
                .map(Collaborator::getId)
                .toList();
        List<String> alreadyAddedUsers = users.stream()
                .filter(existingUserIds::contains)
                .toList();
        if (!alreadyAddedUsers.isEmpty()) {
            throw new ApiException("Users already added to project: " + String.join(", ", alreadyAddedUsers), 400);
        }

        // Mirrors the redundant re-fetch + adminOnlyEdit guard in Node.
        Project project = projectRepository.findById(projectId).orElse(null);
        if (project == null) throw new ApiException("User not Belong to this project ", 400);

        if (project.isAdminOnlyEdit() && !isAdmin(userId, projectId)) {
            throw new ApiException("Only admins can add collaborators when adminOnlyEdit is enabled", 400);
        }

        // Push new collaborators.
        for (User u : validUsers) {
            project.getCollaborators().add(new Collaborator(u.getId(), accessLevel));
        }
        Project updatedProject = projectRepository.save(project);

        // Add project to each newly added user's projects.
        for (User u : validUsers) {
            User fresh = userRepository.findById(u.getId()).orElse(null);
            if (fresh != null) {
                fresh.getProjects().add(projectId);
                userRepository.save(fresh);
            }
        }

        return projectToMap(updatedProject, true);
    }

    // ------------------------------------------------------------------
    // leaveProject
    // ------------------------------------------------------------------

    public Project leaveProject(String projectId, String userId) {
        if (projectId == null || projectId.isEmpty()) throw new ApiException("Project ID is required", 400);
        if (userId == null || userId.isEmpty()) throw new ApiException("User ID is required", 400);

        Project project = projectRepository.findById(projectId).orElse(null);
        if (project == null) throw new ApiException("Project not found", 400);

        Collaborator userCollaborator = project.getCollaborators().stream()
                .filter(c -> userId.equals(c.getId()))
                .findFirst()
                .orElse(null);

        if (userCollaborator == null) {
            throw new ApiException("User is not a collaborator on this project", 400);
        }

        // Cannot leave if you are the only admin.
        if ("admin".equals(userCollaborator.getAccessLevel())) {
            long adminCount = project.getCollaborators().stream()
                    .filter(c -> "admin".equals(c.getAccessLevel()))
                    .count();
            if (adminCount <= 1) {
                // Node controller maps messages containing "only admin" to 403.
                throw new ApiException(
                        "Cannot leave the project as you are the only admin. Transfer admin rights first.", 403);
            }
        }

        List<Collaborator> updatedCollaborators = new ArrayList<>(project.getCollaborators().stream()
                .filter(c -> !userId.equals(c.getId()))
                .toList());
        project.setCollaborators(updatedCollaborators);
        Project updatedProject = projectRepository.save(project);

        // Remove project from user's projects list.
        User user = userRepository.findById(userId).orElse(null);
        if (user != null) {
            List<String> filtered = new ArrayList<>(user.getProjects().stream()
                    .filter(p -> !p.equals(projectId))
                    .toList());
            user.setProjects(filtered);
            userRepository.save(user);
        }

        return updatedProject;
    }

    // ------------------------------------------------------------------
    // updateCollaboratorAccess
    // ------------------------------------------------------------------

    public Map<String, Object> updateCollaboratorAccess(String projectId,
                                                        String userId,
                                                        String collaboratorId,
                                                        String accessLevel) {
        if (!isAdmin(userId, projectId)) {
            throw new ApiException("Only admins can modify access levels", 403);
        }

        if (!("admin".equals(accessLevel) || "readwrite".equals(accessLevel) || "readonly".equals(accessLevel))) {
            throw new ApiException("Invalid access level", 400);
        }

        Project project = projectRepository.findById(projectId).orElse(null);
        if (project == null) throw new ApiException("Project not found", 400);

        if (project.isAdminOnlyEdit() && !isAdmin(userId, projectId)) {
            throw new ApiException("Only admins can modify collaborator access when adminOnlyEdit is enabled", 403);
        }

        // Cannot change access of the project creator.
        if (collaboratorId.equals(project.getCreator())) {
            throw new ApiException("Cannot modify the project creator's access level", 400);
        }

        boolean collaboratorExists = project.getCollaborators().stream()
                .anyMatch(c -> collaboratorId.equals(c.getId()));
        if (!collaboratorExists) {
            throw new ApiException("Collaborator not found in the project", 400);
        }

        for (Collaborator c : project.getCollaborators()) {
            if (collaboratorId.equals(c.getId())) {
                c.setAccessLevel(accessLevel);
            }
        }
        Project updatedProject = projectRepository.save(project);

        return projectToMap(updatedProject, true);
    }

    // ------------------------------------------------------------------
    // removeCollaborator
    // ------------------------------------------------------------------

    public Map<String, Object> removeCollaborator(String projectId,
                                                  String userId,
                                                  String collaboratorId) {
        if (projectId == null || projectId.isEmpty()) throw new ApiException("Project ID is required", 400);
        if (collaboratorId == null || collaboratorId.isEmpty()) throw new ApiException("Collaborator ID is required", 400);

        if (!isAdmin(userId, projectId)) {
            throw new ApiException("Only admins can remove collaborators", 403);
        }

        Project project = projectRepository.findById(projectId).orElse(null);
        if (project == null) throw new ApiException("Project not found", 400);

        if (project.isAdminOnlyEdit() && !isAdmin(userId, projectId)) {
            throw new ApiException("Only admins can remove collaborators when adminOnlyEdit is enabled", 403);
        }

        if (collaboratorId.equals(project.getCreator())) {
            throw new ApiException("Cannot remove project creator", 400);
        }

        List<Collaborator> updatedCollaborators = new ArrayList<>(project.getCollaborators().stream()
                .filter(c -> !collaboratorId.equals(c.getId()))
                .toList());
        project.setCollaborators(updatedCollaborators);
        Project updatedProject = projectRepository.save(project);

        // Remove project from removed user's projects.
        User collabUser = userRepository.findById(collaboratorId).orElse(null);
        if (collabUser != null) {
            List<String> filtered = new ArrayList<>(collabUser.getProjects().stream()
                    .filter(id -> !id.equals(projectId))
                    .toList());
            collabUser.setProjects(filtered);
            userRepository.save(collabUser);
        }

        return projectToMap(updatedProject, true);
    }

    // ------------------------------------------------------------------
    // getProjectById -> { project, userAccess }
    // ------------------------------------------------------------------

    public Map<String, Object> getProjectById(String projectId, String userId) {
        if (projectId == null || projectId.isEmpty()) throw new ApiException("Project ID is required", 400);

        Project project = projectRepository.findById(projectId).orElse(null);
        if (project == null) throw new ApiException("Project not found", 404);

        boolean isCreator = userId.equals(project.getCreator());
        boolean isCollaborator = project.getCollaborators().stream()
                .anyMatch(c -> userId.equals(c.getId()));

        if (!isCreator && !isCollaborator) {
            throw new ApiException("Access denied", 403);
        }

        String accessLevel = "readonly";
        if (isCreator) {
            accessLevel = "admin";
        } else {
            String collabLevel = project.getCollaborators().stream()
                    .filter(c -> userId.equals(c.getId()))
                    .map(Collaborator::getAccessLevel)
                    .findFirst()
                    .orElse(null);
            if (collabLevel != null) {
                accessLevel = collabLevel;
            }
        }

        Map<String, Object> userAccess = new LinkedHashMap<>();
        userAccess.put("accessLevel", accessLevel);
        userAccess.put("isAdmin", "admin".equals(accessLevel));
        userAccess.put("canWrite", "admin".equals(accessLevel) || "readwrite".equals(accessLevel));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("project", projectToMap(project, true));
        result.put("userAccess", userAccess);
        return result;
    }

    // ------------------------------------------------------------------
    // updateFileTree
    // ------------------------------------------------------------------

    public Project updateFileTree(String projectId, Object fileTree, String userId) {
        if (projectId == null || projectId.isEmpty()) throw new ApiException("Project ID is required", 400);
        if (fileTree == null) throw new ApiException("File tree is required", 400);

        if (!hasWriteAccess(userId, projectId)) {
            throw new ApiException("You do not have write access to this project", 403);
        }

        Project project = projectRepository.findById(projectId).orElse(null);
        if (project == null) throw new ApiException("Project not found", 400);

        project.setFileTree(fileTree);
        project.setVersion(project.getVersion() + 1);
        return projectRepository.save(project);
    }

    // ------------------------------------------------------------------
    // updateProject
    // ------------------------------------------------------------------

    public Project updateProject(String projectId,
                                 String name,
                                 String language,
                                 String description,
                                 String scheduledTime,
                                 String expiryTime,
                                 Boolean adminOnlyEdit,
                                 String userId) {
        if (projectId == null || projectId.isEmpty()) throw new ApiException("Project ID is required", 400);

        if (!hasWriteAccess(userId, projectId)) {
            throw new ApiException("You do not have write access to this project", 403);
        }

        Project project = projectRepository.findById(projectId).orElse(null);
        if (project == null) throw new ApiException("Project not found", 400);

        // Prisma assigns each field directly (undefined name/language/description
        // in the Node update means "no change"; here absent -> keep existing).
        if (name != null) project.setName(name);
        if (language != null) project.setLanguage(language);
        if (description != null) project.setDescription(description);

        // Node: scheduledTime/expiryTime === undefined ? null : value.
        project.setScheduledTime(parseInstantOrNull(scheduledTime));
        project.setExpiryTime(parseInstantOrNull(expiryTime));

        // Node: adminOnlyEdit === undefined ? false : value.
        project.setAdminOnlyEdit(adminOnlyEdit != null && adminOnlyEdit);

        return projectRepository.save(project);
    }

    // ------------------------------------------------------------------
    // deleteProject
    // ------------------------------------------------------------------

    public Project deleteProject(String projectId, String userId) {
        if (projectId == null || projectId.isEmpty()) throw new ApiException("Project ID is required", 400);

        Project project = projectRepository.findById(projectId).orElse(null);
        if (project == null) throw new ApiException("Project not found", 404);

        if (!isAdmin(userId, projectId)) {
            throw new ApiException("Only project admins can delete projects", 403);
        }

        projectRepository.deleteById(projectId);

        // Remove project from all users' projects (Prisma: projects has projectId).
        Query q = new Query(Criteria.where("projects").in(List.of(projectId)));
        List<User> users = mongoTemplate.find(q, User.class);
        for (User user : users) {
            List<String> filtered = new ArrayList<>(user.getProjects().stream()
                    .filter(id -> !id.equals(projectId))
                    .toList());
            user.setProjects(filtered);
            userRepository.save(user);
        }

        return project;
    }

    // ------------------------------------------------------------------
    // generateShareLink
    // ------------------------------------------------------------------

    public Map<String, Object> generateShareLink(String projectId,
                                                 String userId,
                                                 String accessLevel,
                                                 Integer expirationDays) {
        if (accessLevel == null) accessLevel = "readonly";
        int days = (expirationDays == null) ? 7 : expirationDays;

        if (projectId == null || projectId.isEmpty()) throw new ApiException("Project ID is required", 400);

        String userAccessLevel = getUserAccessLevel(userId, projectId);
        if (userAccessLevel == null) {
            throw new ApiException("You do not have access to this project", 400);
        }

        // Only admins can generate share links with elevated (non-readonly) permissions.
        if (!"readonly".equals(accessLevel) && !"admin".equals(userAccessLevel)) {
            throw new ApiException("Only admins can generate share links with elevated permissions", 403);
        }

        // readonly links require at least write access.
        if ("readonly".equals(accessLevel)
                && !("admin".equals(userAccessLevel) || "readwrite".equals(userAccessLevel))) {
            throw new ApiException("You need at least write access to generate share links", 403);
        }

        if (!("readwrite".equals(accessLevel) || "readonly".equals(accessLevel))) {
            throw new ApiException("Invalid access level for share link", 400);
        }

        String token = UUID.randomUUID().toString();
        Instant expiresAt = Instant.now().plus(days, ChronoUnit.DAYS);

        ShareLink shareLink = new ShareLink();
        shareLink.setToken(token);
        shareLink.setProjectId(projectId);
        shareLink.setAccessLevel(accessLevel);
        shareLink.setExpiresAt(expiresAt);
        ShareLink saved = shareLinkRepository.save(shareLink);

        // FRONTEND_URL may be comma-separated; use first origin, strip trailing slash.
        String shareBaseUrl = frontendUrl.split(",")[0].trim().replaceAll("/$", "");

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", saved.getId());
        result.put("token", saved.getToken());
        result.put("projectId", saved.getProjectId());
        result.put("accessLevel", saved.getAccessLevel());
        result.put("createdAt", saved.getCreatedAt());
        result.put("expiresAt", saved.getExpiresAt());
        result.put("shareUrl", shareBaseUrl + "/join/" + saved.getToken());
        return result;
    }

    // ------------------------------------------------------------------
    // joinProjectViaLink
    // ------------------------------------------------------------------

    public Project joinProjectViaLink(String token, String userId) {
        if (token == null || token.isEmpty()) throw new ApiException("Token is required", 400);
        if (userId == null || userId.isEmpty()) throw new ApiException("User ID is required", 400);

        ShareLink shareLink = shareLinkRepository.findByToken(token).orElse(null);
        if (shareLink == null) {
            throw new ApiException("Invalid or expired share link", 404);
        }

        if (shareLink.getExpiresAt() != null && shareLink.getExpiresAt().isBefore(Instant.now())) {
            throw new ApiException("Share link has expired", 400);
        }

        Project project = projectRepository.findById(shareLink.getProjectId()).orElse(null);
        if (project == null) {
            throw new ApiException("Project not found", 400);
        }

        // Faithful to Node: it checks collab.userId (a field collaborators do NOT
        // have), so isCollaborator is effectively always false there; the real
        // guard is creator == userId. Replicated exactly.
        boolean isCollaborator = false;

        if (userId.equals(project.getCreator()) || isCollaborator) {
            throw new ApiException("You are already a collaborator on this project", 400);
        }

        project.getCollaborators().add(new Collaborator(userId, shareLink.getAccessLevel()));
        Project updatedProject = projectRepository.save(project);

        // Add project to user's projects.
        User user = userRepository.findById(userId).orElse(null);
        if (user != null) {
            user.getProjects().add(shareLink.getProjectId());
            userRepository.save(user);
        }

        return updatedProject;
    }

    // ------------------------------------------------------------------
    // toggleAdminOnlyEdit
    // ------------------------------------------------------------------

    public Project toggleAdminOnlyEdit(String projectId, String userId) {
        // Node toggleAdminOnlyEditController catches ALL errors as 500.
        if (!isAdmin(userId, projectId)) {
            throw new ApiException("Only admins can toggle this setting", 500);
        }

        Project project = projectRepository.findById(projectId).orElse(null);
        if (project == null) throw new ApiException("Project not found", 500);

        project.setAdminOnlyEdit(!project.isAdminOnlyEdit());
        return projectRepository.save(project);
    }

    // ------------------------------------------------------------------
    // addMessageToProject
    // ------------------------------------------------------------------

    public Project addMessageToProject(String projectId, Message newMessage) {
        // Node addMessageController catches ALL errors as 500.
        Project project = projectRepository.findById(projectId).orElse(null);
        if (project == null) throw new ApiException("Project not found", 500);

        project.getMessages().add(newMessage);
        return projectRepository.save(project);
    }

    // ------------------------------------------------------------------
    // Internal helpers
    // ------------------------------------------------------------------

    /**
     * Serializes a Project to a LinkedHashMap, optionally enriching each
     * collaborator with its user's email (Node attaches id + email to every
     * collaborator before returning). Keeps the field order/shape the frontend
     * expects.
     */
    private Map<String, Object> projectToMap(Project project, boolean enrichCollaborators) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", project.getId());
        map.put("name", project.getName());
        map.put("creator", project.getCreator());
        map.put("language", project.getLanguage());
        map.put("description", project.getDescription());
        map.put("collaborators", enrichCollaborators
                ? enrichCollaborators(project.getCollaborators())
                : project.getCollaborators());
        Object ft = project.getFileTree();
        if (ft instanceof List && ((List<?>) ft).isEmpty()) {
            ft = new LinkedHashMap<>();
        }
        map.put("fileTree", ft);
        map.put("adminOnlyEdit", project.isAdminOnlyEdit());
        map.put("__v", project.getVersion());
        map.put("messages", project.getMessages());
        map.put("scheduledTime", project.getScheduledTime());
        map.put("expiryTime", project.getExpiryTime());
        return map;
    }

    /** Builds collaborator maps with id/email/accessLevel/addedAt, mirroring the Node enrichment. */
    private List<Map<String, Object>> enrichCollaborators(List<Collaborator> collaborators) {
        List<Map<String, Object>> enriched = new ArrayList<>();
        for (Collaborator c : collaborators) {
            Optional<User> details = userRepository.findById(c.getId());
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", details.map(User::getId).orElse(null));
            m.put("email", details.map(User::getEmail).orElse(null));
            m.put("accessLevel", c.getAccessLevel());
            m.put("addedAt", c.getAddedAt());
            enriched.add(m);
        }
        return enriched;
    }

    /** Parses an ISO-8601 string into an Instant; null/blank -> null (Node treats undefined -> null). */
    private Instant parseInstantOrNull(String iso) {
        if (iso == null || iso.isBlank()) return null;
        return Instant.parse(iso);
    }
}
