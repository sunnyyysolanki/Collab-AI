package com.collab.backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Request bodies for /users/register and /users/login.
 * Validation mirrors express-validator: valid email, password min length 3.
 */
public class AuthDtos {

    public record RegisterRequest(
            @Email(message = "Email must be valid email address")
            @NotBlank(message = "Email must be valid email address")
            String email,

            @Size(min = 3, message = "Password must be at least 3 characters long")
            String password
    ) {}

    public record LoginRequest(
            @Email(message = "Email must be valid email address")
            @NotBlank(message = "Email must be valid email address")
            String email,

            @Size(min = 3, message = "Password must be at least 3 characters long")
            String password
    ) {}
}
