package com.collab.backend.controller;

import com.collab.backend.service.AiService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Ports ai.controller.ts + ai.routes.ts.
 * GET /ai/get-result?prompt=... -> { result: "<gemini json/text>" }
 */
@RestController
@RequestMapping("/ai")
public class AiController {

    private final AiService aiService;

    public AiController(AiService aiService) {
        this.aiService = aiService;
    }

    @GetMapping("/get-result")
    public ResponseEntity<?> getResult(@RequestParam String prompt) {
        String result = aiService.generateResult(prompt);
        return ResponseEntity.ok(Map.of("result", result));
    }
}
