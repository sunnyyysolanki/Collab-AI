package com.collab.backend.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;

import java.util.List;

/**
 * Request bodies for the /project endpoints.
 * Validation mirrors the express-validator rules in project.routes.ts.
 * (Optional fields with only a type rule in express-validator are left
 *  un-annotated here since absence is allowed and the type is enforced by
 *  Jackson binding.)
 */
public class ProjectDtos {

    // POST /project/create
    //   body('name'|'language'|'description').isString()  (all required)
    //   scheduledTime / expiryTime optional ISO 8601 strings
    public record CreateProjectRequest(
            @NotBlank(message = "Name is required")
            String name,

            @NotBlank(message = "Language is required")
            String language,

            @NotBlank(message = "Description is required")
            String description,

            String scheduledTime,
            String expiryTime
    ) {}

    // PUT /project/add-user
    //   projectId string, users array (min 1) of strings,
    //   accessLevel string in [admin, readwrite, readonly]
    public record AddUserRequest(
            @NotBlank(message = "Project ID is required")
            String projectId,

            @NotEmpty(message = "Users must be an array of strings")
            List<String> users,

            @NotBlank(message = "Access level is required")
            @Pattern(regexp = "admin|readwrite|readonly",
                     message = "Access level must be admin, readwrite, or readonly")
            String accessLevel
    ) {}

    // PUT /project/leave-project  -> projectId string
    public record LeaveProjectRequest(
            @NotBlank(message = "Project ID is required")
            String projectId
    ) {}

    // PATCH /project/update-collaborator-access
    public record UpdateCollaboratorAccessRequest(
            @NotBlank(message = "Project ID is required")
            String projectId,

            @NotBlank(message = "Collaborator ID is required")
            String collaboratorId,

            @NotBlank(message = "Access level is required")
            @Pattern(regexp = "admin|readwrite|readonly",
                     message = "Access level must be admin, readwrite, or readonly")
            String accessLevel
    ) {}

    // POST /project/remove-collaborator
    public record RemoveCollaboratorRequest(
            @NotBlank(message = "Project ID is required")
            String projectId,

            @NotBlank(message = "collaboratorId is required")
            String collaboratorId
    ) {}

    // PUT /project/update-file-tree
    //   projectId string, fileTree object (fileTree is arbitrary JSON -> Object)
    public record UpdateFileTreeRequest(
            @NotBlank(message = "Project ID is required")
            String projectId,

            Object fileTree
    ) {}

    // PATCH /project/update/{projectId}
    //   all fields optional; type-only rules in express-validator.
    public record UpdateProjectRequest(
            String name,
            String language,
            String description,
            String scheduledTime,
            String expiryTime,
            Boolean adminOnlyEdit
    ) {}

    // POST /project/share-link
    //   projectId string, accessLevel optional in [readwrite, readonly],
    //   expirationDays optional int 1..30
    public record ShareLinkRequest(
            @NotBlank(message = "Project ID is required")
            String projectId,

            @Pattern(regexp = "readwrite|readonly",
                     message = "Access level must be readwrite or readonly")
            String accessLevel,

            @Min(value = 1, message = "Expiration days must be between 1 and 30")
            @Max(value = 30, message = "Expiration days must be between 1 and 30")
            Integer expirationDays
    ) {}

    // POST /project/add-message  -> projectId string, message string
    public record AddMessageRequest(
            @NotBlank(message = "Project ID is required")
            String projectId,

            @NotBlank(message = "message is required")
            String message
    ) {}
}
