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
 * Replaces the Node authUser middleware.
 * - Reads token from the Authorization header (Bearer) or the "token" cookie
 * - Rejects blacklisted (logged-out) tokens via Redis
 * - Verifies the JWT and attaches an AuthUser to the request
 *
 * Applied only to protected paths (see SecurityPaths). Public paths
 * (/users/register, /users/login, /project/join is protected in Node) pass through.
 */
@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper = new ObjectMapper();

    // Paths that do NOT require auth (match the Node routes without authUser).
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

        try {
            // Redis blacklist check (logout stores the token with a TTL).
            Boolean blacklisted = redis.hasKey(token);
            if (Boolean.TRUE.equals(blacklisted)) {
                unauthorized(response, "redis Unauthorized user");
                return;
            }

            Claims claims = jwtUtil.parse(token);
            AuthUser user = new AuthUser(
                    claims.get("userId", String.class),
                    claims.get("email", String.class)
            );
            request.setAttribute(AuthUser.REQUEST_ATTRIBUTE, user);
            chain.doFilter(request, response);
        } catch (Exception e) {
            unauthorized(response, "Please authenticate");
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
