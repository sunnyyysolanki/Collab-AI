package com.collab.backend.controller;

import com.collab.backend.dto.ProjectDtos.AddMessageRequest;
import com.collab.backend.dto.ProjectDtos.AddUserRequest;
import com.collab.backend.dto.ProjectDtos.CreateProjectRequest;
import com.collab.backend.dto.ProjectDtos.LeaveProjectRequest;
import com.collab.backend.dto.ProjectDtos.RemoveCollaboratorRequest;
import com.collab.backend.dto.ProjectDtos.ShareLinkRequest;
import com.collab.backend.dto.ProjectDtos.UpdateCollaboratorAccessRequest;
import com.collab.backend.dto.ProjectDtos.UpdateFileTreeRequest;
import com.collab.backend.dto.ProjectDtos.UpdateProjectRequest;
import com.collab.backend.model.Message;
import com.collab.backend.model.Project;
import com.collab.backend.security.AuthUser;
import com.collab.backend.service.ProjectService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Ports project.controller.ts + project.routes.ts.
 * Paths and response JSON shapes match the Node backend exactly.
 *
 * Business errors are thrown as ApiException from the service and translated to
 * the right status/{message} by GlobalExceptionHandler, so no per-endpoint
 * try/catch mapping is needed here (the status codes were baked into the throws).
 */
@RestController
@RequestMapping("/project")
public class ProjectController {

    private final ProjectService projectService;

    public ProjectController(ProjectService projectService) {
        this.projectService = projectService;
    }

    // POST /project/create -> 201 { project }
    @PostMapping("/create")
    public ResponseEntity<?> create(@Valid @RequestBody CreateProjectRequest req,
                                    HttpServletRequest request) {
        String userId = auth(request).userId();
        Project project = projectService.createProject(
                req.name(),
                userId,
                req.language(),
                req.description(),
                parseInstant(req.scheduledTime()),
                parseInstant(req.expiryTime())
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("project", project));
    }

    // GET /project/all -> { projects }
    @GetMapping("/all")
    public ResponseEntity<?> getAll(HttpServletRequest request) {
        String userId = auth(request).userId();
        List<Map<String, Object>> projects = projectService.getAllProjectsByUserId(userId);
        return ResponseEntity.ok(Map.of("projects", projects));
    }

    // PUT /project/add-user -> { project }
    @PutMapping("/add-user")
    public ResponseEntity<?> addUser(@Valid @RequestBody AddUserRequest req,
                                     HttpServletRequest request) {
        String userId = auth(request).userId();
        Map<String, Object> project = projectService.addUserToProject(
                req.projectId(), userId, req.users(), req.accessLevel());
        return ResponseEntity.ok(Map.of("project", project));
    }

    // PUT /project/leave-project -> { message, project }
    @PutMapping("/leave-project")
    public ResponseEntity<?> leaveProject(@Valid @RequestBody LeaveProjectRequest req,
                                          HttpServletRequest request) {
        String userId = auth(request).userId();
        Project project = projectService.leaveProject(req.projectId(), userId);
        return ResponseEntity.ok(Map.of(
                "message", "Successfully left the project",
                "project", project
        ));
    }

    // PATCH /project/update-collaborator-access -> { project }
    @PatchMapping("/update-collaborator-access")
    public ResponseEntity<?> updateCollaboratorAccess(@Valid @RequestBody UpdateCollaboratorAccessRequest req,
                                                      HttpServletRequest request) {
        String userId = auth(request).userId();
        Map<String, Object> project = projectService.updateCollaboratorAccess(
                req.projectId(), userId, req.collaboratorId(), req.accessLevel());
        return ResponseEntity.ok(Map.of("project", project));
    }

    // GET /project/get-project/{projectId} -> { project, userAccess }
    @GetMapping("/get-project/{projectId}")
    public ResponseEntity<?> getProjectById(@PathVariable String projectId,
                                            HttpServletRequest request) {
        String userId = auth(request).userId();
        Map<String, Object> result = projectService.getProjectById(projectId, userId);
        return ResponseEntity.ok(result);
    }

    // PUT /project/update-file-tree -> { project }
    @PutMapping("/update-file-tree")
    public ResponseEntity<?> updateFileTree(@Valid @RequestBody UpdateFileTreeRequest req,
                                            HttpServletRequest request) {
        String userId = auth(request).userId();
        Project project = projectService.updateFileTree(req.projectId(), req.fileTree(), userId);
        return ResponseEntity.ok(Map.of("project", project));
    }

    // DELETE /project/delete/{projectId} -> { message }
    @DeleteMapping("/delete/{projectId}")
    public ResponseEntity<?> deleteProject(@PathVariable String projectId,
                                           HttpServletRequest request) {
        String userId = auth(request).userId();
        projectService.deleteProject(projectId, userId);
        return ResponseEntity.ok(Map.of("message", "Project deleted successfully"));
    }

    // PATCH /project/update/{projectId} -> { project }
    @PatchMapping("/update/{projectId}")
    public ResponseEntity<?> updateProject(@PathVariable String projectId,
                                           @Valid @RequestBody UpdateProjectRequest req,
                                           HttpServletRequest request) {
        String userId = auth(request).userId();
        Project project = projectService.updateProject(
                projectId,
                req.name(),
                req.language(),
                req.description(),
                req.scheduledTime(),
                req.expiryTime(),
                req.adminOnlyEdit(),
                userId
        );
        return ResponseEntity.ok(Map.of("project", project));
    }

    // POST /project/share-link -> 201 shareLink object
    @PostMapping("/share-link")
    public ResponseEntity<?> generateShareLink(@Valid @RequestBody ShareLinkRequest req,
                                               HttpServletRequest request) {
        String userId = auth(request).userId();
        Map<String, Object> shareLink = projectService.generateShareLink(
                req.projectId(), userId, req.accessLevel(), req.expirationDays());
        return ResponseEntity.status(HttpStatus.CREATED).body(shareLink);
    }

    // GET /project/join/{token} -> { project, message }
    @GetMapping("/join/{token}")
    public ResponseEntity<?> joinProjectViaLink(@PathVariable String token,
                                                HttpServletRequest request) {
        String userId = auth(request).userId();
        Project project = projectService.joinProjectViaLink(token, userId);
        return ResponseEntity.ok(Map.of(
                "project", project,
                "message", "You have successfully joined the project"
        ));
    }

    // POST /project/remove-collaborator -> { project }
    @PostMapping("/remove-collaborator")
    public ResponseEntity<?> removeCollaborator(@Valid @RequestBody RemoveCollaboratorRequest req,
                                                HttpServletRequest request) {
        String userId = auth(request).userId();
        Map<String, Object> project = projectService.removeCollaborator(
                req.projectId(), userId, req.collaboratorId());
        return ResponseEntity.ok(Map.of("project", project));
    }

    // PATCH /project/toggle-admin-only-edit/{projectId} -> { project }
    @PatchMapping("/toggle-admin-only-edit/{projectId}")
    public ResponseEntity<?> toggleAdminOnlyEdit(@PathVariable String projectId,
                                                 HttpServletRequest request) {
        String userId = auth(request).userId();
        Project project = projectService.toggleAdminOnlyEdit(projectId, userId);
        return ResponseEntity.ok(Map.of("project", project));
    }

    // POST /project/add-message -> { project }
    @PostMapping("/add-message")
    public ResponseEntity<?> addMessage(@Valid @RequestBody AddMessageRequest req,
                                        HttpServletRequest request) {
        AuthUser auth = auth(request);
        // Node: sender = req.user.email, createdAt = new Date().toISOString().
        Message newMessage = new Message(auth.email(), req.message());
        Project project = projectService.addMessageToProject(req.projectId(), newMessage);
        return ResponseEntity.ok(Map.of("project", project));
    }

    // ------------------------------------------------------------------

    private AuthUser auth(HttpServletRequest request) {
        return (AuthUser) request.getAttribute(AuthUser.REQUEST_ATTRIBUTE);
    }

    private Instant parseInstant(String iso) {
        if (iso == null || iso.isBlank()) return null;
        return Instant.parse(iso);
    }
}
