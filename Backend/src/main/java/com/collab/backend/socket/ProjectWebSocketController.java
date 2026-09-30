package com.collab.backend.socket;

import com.collab.backend.repository.ProjectRepository;
import com.collab.backend.service.AiService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Controller;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.util.HashMap;
import java.util.Map;

@Controller
public class ProjectWebSocketController {

    private final SimpMessagingTemplate messagingTemplate;
    private final AiService aiService;
    private final ProjectRepository projectRepository;
    private final ObjectMapper mapper = new ObjectMapper();

    public ProjectWebSocketController(SimpMessagingTemplate messagingTemplate, AiService aiService,
                                      ProjectRepository projectRepository) {
        this.messagingTemplate = messagingTemplate;
        this.aiService = aiService;
        this.projectRepository = projectRepository;
    }

    @MessageMapping("/project/{projectId}/project-message")
    public void handleProjectMessage(@DestinationVariable String projectId, @Payload Object data, SimpMessageHeaderAccessor headerAccessor) {
        String message = messageText(data);
        boolean aiMentioned = message != null && (message.contains("@AI") || message.contains("@ai"));

        if (aiMentioned) {
            String prompt = message.replace("@AI", "").replace("@ai", "").trim();
            // The frontend runs each language with a different engine (WebContainer /
            // iframe / Judge0), so the model has to target the right one.
            String result = aiService.generateResult(prompt, projectLanguage(projectId));
            Map<String, Object> aiResponse = new HashMap<>();
            aiResponse.put("message", result);
            aiResponse.put("sender", "AI");
            messagingTemplate.convertAndSend("/topic/project/" + projectId + "/project-message", aiResponse);
            return;
        }

        messagingTemplate.convertAndSend("/topic/project/" + projectId + "/project-message", data);
    }

    @MessageMapping("/project/{projectId}/project-code")
    public void handleProjectCode(@DestinationVariable String projectId, @Payload Object data) {
        messagingTemplate.convertAndSend("/topic/project/" + projectId + "/project-code", data);
    }

    @MessageMapping("/project/{projectId}/fileTree-update")
    public void handleFileTreeUpdate(@DestinationVariable String projectId, @Payload Object data) {
        messagingTemplate.convertAndSend("/topic/project/" + projectId + "/fileTree-update", data);
    }

    @MessageMapping("/project/{projectId}/files-imported")
    public void handleFilesImported(@DestinationVariable String projectId, @Payload Map<String, Object> data, SimpMessageHeaderAccessor headerAccessor) {
        String email = (String) headerAccessor.getSessionAttributes().get("email");
        Map<String, Object> response = new HashMap<>();
        response.put("importedItems", data.get("importedItems"));
        response.put("username", email);
        messagingTemplate.convertAndSend("/topic/project/" + projectId + "/files-imported", response);
    }

    @MessageMapping("/project/{projectId}/file-renamed")
    public void handleFileRenamed(@DestinationVariable String projectId, @Payload Map<String, Object> data, SimpMessageHeaderAccessor headerAccessor) {
        String email = (String) headerAccessor.getSessionAttributes().get("email");
        Map<String, Object> response = new HashMap<>(data);
        response.put("username", email);
        messagingTemplate.convertAndSend("/topic/project/" + projectId + "/file-renamed", response);
    }

    @MessageMapping("/project/{projectId}/file-created")
    public void handleFileCreated(@DestinationVariable String projectId, @Payload Map<String, Object> data, SimpMessageHeaderAccessor headerAccessor) {
        String email = (String) headerAccessor.getSessionAttributes().get("email");
        Map<String, Object> response = new HashMap<>(data);
        response.put("username", email);
        messagingTemplate.convertAndSend("/topic/project/" + projectId + "/file-created", response);
    }

    @MessageMapping("/project/{projectId}/file-deleted")
    public void handleFileDeleted(@DestinationVariable String projectId, @Payload Map<String, Object> data, SimpMessageHeaderAccessor headerAccessor) {
        String email = (String) headerAccessor.getSessionAttributes().get("email");
        Map<String, Object> response = new HashMap<>(data);
        response.put("username", email);
        messagingTemplate.convertAndSend("/topic/project/" + projectId + "/file-deleted", response);
    }

    @MessageMapping("/project/{projectId}/user-cursor-move")
    public void handleUserCursorMove(@DestinationVariable String projectId, @Payload Map<String, Object> data, SimpMessageHeaderAccessor headerAccessor) {
        if (data == null || data.get("position") == null) return;
        String email = (String) headerAccessor.getSessionAttributes().get("email");
        String userId = (String) headerAccessor.getSessionAttributes().get("userId");
        if (userId == null) userId = headerAccessor.getSessionId();
        
        Map<String, Object> response = new HashMap<>();
        response.put("userId", userId);
        response.put("username", email);
        response.put("position", data.get("position"));
        messagingTemplate.convertAndSend("/topic/project/" + projectId + "/update-cursor", response);
    }

    @MessageMapping("/project/{projectId}/user-highlight")
    public void handleUserHighlight(@DestinationVariable String projectId, @Payload Map<String, Object> data, SimpMessageHeaderAccessor headerAccessor) {
        if (data == null || data.get("range") == null) return;
        String email = (String) headerAccessor.getSessionAttributes().get("email");
        String userId = (String) headerAccessor.getSessionAttributes().get("userId");
        if (userId == null) userId = headerAccessor.getSessionId();

        Map<String, Object> response = new HashMap<>();
        response.put("userId", userId);
        response.put("username", email);
        response.put("range", data.get("range"));
        messagingTemplate.convertAndSend("/topic/project/" + projectId + "/update-highlight", response);
    }

    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        Map<String, Object> sessionAttributes = headerAccessor.getSessionAttributes();
        if (sessionAttributes != null && sessionAttributes.containsKey("projectId")) {
            String projectId = (String) sessionAttributes.get("projectId");
            String email = (String) sessionAttributes.get("email");
            String userId = (String) sessionAttributes.get("userId");
            if (userId == null) userId = headerAccessor.getSessionId();
            
            Map<String, Object> response = new HashMap<>();
            response.put("userId", userId);
            response.put("username", email == null ? "" : email);
            messagingTemplate.convertAndSend("/topic/project/" + projectId + "/remove-cursor", response);
        }
    }

    /**
     * The project's language, or null when it can't be resolved — AiService then
     * falls back to the Node rules rather than failing the whole AI request.
     */
    private String projectLanguage(String projectId) {
        try {
            return projectRepository.findById(projectId)
                    .map(p -> p.getLanguage())
                    .orElse(null);
        } catch (Exception e) {
            System.err.println("Could not resolve language for project " + projectId + ": " + e.getMessage());
            return null;
        }
    }

    private String messageText(Object data) {
        try {
            if (data instanceof Map<?, ?> m && m.get("message") != null) {
                return m.get("message").toString();
            }
            if (data instanceof byte[] b) {
                return mapper.readTree(b).path("message").asText(null);
            }
            if (data instanceof String s) {
                return mapper.readTree(s).path("message").asText(null);
            }
            var node = mapper.valueToTree(data);
            return node.path("message").asText(null);
        } catch (Exception e) {
            return null;
        }
    }
}
