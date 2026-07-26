package com.collab.backend.socket;

import com.collab.backend.model.Project;
import com.collab.backend.repository.ProjectRepository;
import com.collab.backend.security.JwtUtil;
import io.jsonwebtoken.Claims;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

import java.security.Principal;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

@Component
public class WebSocketAuthInterceptor implements ChannelInterceptor {

    private final JwtUtil jwtUtil;
    private final ProjectRepository projectRepository;

    public WebSocketAuthInterceptor(JwtUtil jwtUtil, ProjectRepository projectRepository) {
        this.jwtUtil = jwtUtil;
        this.projectRepository = projectRepository;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

        if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())) {
            List<String> authorization = accessor.getNativeHeader("Authorization");
            List<String> projectIdHeaders = accessor.getNativeHeader("projectId");

            if (authorization == null || authorization.isEmpty()) {
                throw new IllegalArgumentException("No token provided");
            }
            if (projectIdHeaders == null || projectIdHeaders.isEmpty()) {
                throw new IllegalArgumentException("No projectId provided");
            }

            String token = authorization.get(0);
            if (token.startsWith("Bearer ")) {
                token = token.substring(7);
            }

            String projectId = projectIdHeaders.get(0);
            Optional<Project> project = projectRepository.findById(projectId);
            if (project.isEmpty()) {
                throw new IllegalArgumentException("Invalid project");
            }

            Claims claims = jwtUtil.parse(token);
            String email = claims.get("email", String.class);
            String userId = claims.get("userId", String.class);

            accessor.getSessionAttributes().put("projectId", projectId);
            accessor.getSessionAttributes().put("email", email);
            accessor.getSessionAttributes().put("userId", userId);
            
            accessor.setUser((Principal) () -> email);
        }
        return message;
    }
}
