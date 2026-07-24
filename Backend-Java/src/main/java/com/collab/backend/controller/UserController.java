package com.collab.backend.controller;

import com.collab.backend.dto.AuthDtos.LoginRequest;
import com.collab.backend.dto.AuthDtos.RegisterRequest;
import com.collab.backend.model.User;
import com.collab.backend.security.AuthUser;
import com.collab.backend.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Ports user.controller.ts + user.routes.ts.
 * Response JSON shapes match the Node backend exactly (frontend depends on them).
 */
@RestController
@RequestMapping("/users")
public class UserController {

    private final UserService userService;
    private final StringRedisTemplate redis;

    public UserController(UserService userService, StringRedisTemplate redis) {
        this.userService = userService;
        this.redis = redis;
    }

    // POST /users/register -> { user: { id, email } }
    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest req) {
        User user = userService.createUser(req.email(), req.password());
        Map<String, Object> safeUser = new LinkedHashMap<>();
        safeUser.put("id", user.getId());
        safeUser.put("email", user.getEmail());
        return ResponseEntity.ok(Map.of("user", safeUser));
    }

    // POST /users/login -> { message, user: { id, email, projects }, token }
    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest req) {
        UserService.LoginResult result = userService.loginUser(req.email(), req.password());
        User u = result.user();

        Map<String, Object> safeUser = new LinkedHashMap<>();
        safeUser.put("id", u.getId());
        safeUser.put("email", u.getEmail());
        safeUser.put("projects", u.getProjects());

        return ResponseEntity.ok(Map.of(
                "message", "Login successful",
                "user", safeUser,
                "token", result.token()
        ));
    }

    // GET /users/profile -> { mess: "success", user: { id, email } }
    @GetMapping("/profile")
    public ResponseEntity<?> profile(HttpServletRequest request) {
        AuthUser auth = (AuthUser) request.getAttribute(AuthUser.REQUEST_ATTRIBUTE);
        return ResponseEntity.ok(Map.of(
                "mess", "success",
                "user", Map.of("id", auth.userId(), "email", auth.email())
        ));
    }

    // GET /users/logout -> blacklist token in Redis for 24h -> { message: "Logged out" }
    @GetMapping("/logout")
    public ResponseEntity<?> logout(HttpServletRequest request) {
        String token = extractToken(request);
        if (token != null) {
            redis.opsForValue().set(token, "logged out", Duration.ofDays(1));
        }
        return ResponseEntity.ok(Map.of("message", "Logged out"));
    }

    // GET /users/all -> [ { id, email }, ... ] (excluding the logged-in user)
    @GetMapping("/all")
    public ResponseEntity<?> getAll(HttpServletRequest request) {
        AuthUser auth = (AuthUser) request.getAttribute(AuthUser.REQUEST_ATTRIBUTE);
        User me = userService.findByEmail(auth.email());
        List<User> users = userService.getAllUsers(me.getId());
        List<Map<String, Object>> result = users.stream().map(u -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", u.getId());
            m.put("email", u.getEmail());
            return m;
        }).toList();
        return ResponseEntity.ok(result);
    }

    private String extractToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) return header.substring(7);
        if (request.getCookies() != null) {
            for (var c : request.getCookies()) {
                if ("token".equals(c.getName())) return c.getValue();
            }
        }
        return null;
    }
}
