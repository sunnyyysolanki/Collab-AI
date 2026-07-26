package com.collab.backend.service;

import com.collab.backend.exception.ApiException;
import com.collab.backend.model.User;
import com.collab.backend.repository.UserRepository;
import com.collab.backend.security.JwtUtil;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Ports user.service.ts: createUser, loginUser, getAllUsers.
 * BCryptPasswordEncoder is hash-compatible with Node's bcrypt ($2a/$2b).
 */
@Service
public class UserService {

    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(10);

    public UserService(UserRepository userRepository, JwtUtil jwtUtil) {
        this.userRepository = userRepository;
        this.jwtUtil = jwtUtil;
    }

    public User createUser(String email, String password) {
        if (email == null || email.isBlank() || password == null || password.isBlank()) {
            throw new ApiException("Email and password are required", 400);
        }
        if (userRepository.findByEmail(email).isPresent()) {
            throw new ApiException("User already exists", 400);
        }
        User user = new User(email, encoder.encode(password));
        return userRepository.save(user);
    }

    /** Returns [token, user] equivalent. */
    public LoginResult loginUser(String email, String password) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ApiException("User does not exist", 404));

        if (!encoder.matches(password, user.getPassword())) {
            throw new ApiException("Invalid credentials", 401);
        }

        String token = jwtUtil.generateToken(user.getId(), user.getEmail());
        return new LoginResult(token, user);
    }

    public List<User> getAllUsers(String excludeUserId) {
        return userRepository.findByIdNot(excludeUserId);
    }

    public User findByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ApiException("User not found", 404));
    }

    public record LoginResult(String token, User user) {}
}
