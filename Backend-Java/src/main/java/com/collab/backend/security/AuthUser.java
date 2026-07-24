package com.collab.backend.security;

/**
 * The authenticated principal placed on the request by JwtAuthFilter.
 * Mirrors the Node `req.user = { userId, email }`.
 */
public record AuthUser(String userId, String email) {
    public static final String REQUEST_ATTRIBUTE = "authUser";
}
