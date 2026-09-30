package com.collab.backend.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.Set;

/**
 * Authenticates incoming requests before they reach the controllers.
 * - Reads token from the Authorization header (Bearer) or the "token" cookie
 * - Rejects blacklisted (logged-out) tokens via Redis
 * - Verifies the JWT and attaches an AuthUser to the request
 *
 * Applied only to protected paths. The public paths listed in PUBLIC_PATHS
 * (/users/register, /users/login and the root path) pass through untouched.
 */
@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper = new ObjectMapper();

    // Paths that do NOT require auth.
    private static final Set<String> PUBLIC_PATHS = Set.of(
            "/users/register",
            "/users/login",
            "/"
    );

    public JwtAuthFilter(JwtUtil jwtUtil, StringRedisTemplate redis) {
        this.jwtUtil = jwtUtil;
        this.redis = redis;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        // Let CORS preflight through untouched.
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) return true;
        return PUBLIC_PATHS.contains(path);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String token = extractToken(request);

        if (token == null) {
            unauthorized(response, "No token Unauthorized user");
            return;
        }

        if (isBlacklisted(token)) {
            unauthorized(response, "redis Unauthorized user");
            return;
        }

        AuthUser user;
        try {
            Claims claims = jwtUtil.parse(token);
            user = new AuthUser(
                    claims.get("userId", String.class),
                    claims.get("email", String.class)
            );
        } catch (Exception e) {
            // A genuinely bad token: bad signature, expired or malformed.
            // Logged because a silent 401 here is near-impossible to diagnose.
            logger.debug("Rejected JWT: " + e.getMessage());
            unauthorized(response, "Please authenticate");
            return;
        }

        request.setAttribute(AuthUser.REQUEST_ATTRIBUTE, user);
        // Outside the try: a failure further down the chain is the handler's
        // problem, not an authentication failure.
        chain.doFilter(request, response);
    }

    /**
     * Logout stores the token in Redis with a TTL; this checks for it.
     *
     * Best-effort on purpose. If Redis is unreachable we log and let the
     * request through rather than locking every user out of the app - the JWT
     * signature check above still has to pass. The trade-off is that while
     * Redis is down an already-logged-out token stays usable until it expires.
     * Previously any Redis error was caught as "Please authenticate", so a
     * stopped Redis made every authenticated request look like a bad token.
     */
    private boolean isBlacklisted(String token) {
        try {
            return Boolean.TRUE.equals(redis.hasKey(token));
        } catch (Exception e) {
            logger.warn("Redis unavailable - skipping token blacklist check: " + e.getMessage());
            return false;
        }
    }

    private String extractToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            return header.substring(7);
        }
        if (request.getCookies() != null) {
            for (Cookie c : request.getCookies()) {
                if ("token".equals(c.getName())) return c.getValue();
            }
        }
        return null;
    }

    private void unauthorized(HttpServletResponse response, String error) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write(objectMapper.writeValueAsString(Map.of("error", error)));
    }
}
