package com.collab.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.List;
import java.util.Map;

/**
 * Ports ai.service.ts. Calls the Gemini generateContent REST endpoint directly
 * via WebClient (the @google/generative-ai SDK just wraps this HTTP call).
 * Mirrors: system instruction, ```json``` stripping, 429/503 retry with backoff,
 * and the graceful "high demand" fallback so the frontend never breaks.
 */
@Service
public class AiService {

    private static final String BASE_URL =
            "https://generativelanguage.googleapis.com/v1beta/models";

    private final WebClient webClient = WebClient.builder().build();
    private final ObjectMapper mapper = new ObjectMapper();

    private final String apiKey;
    private final String model;

    public AiService(
            @Value("${app.gemini.api-key}") String apiKey,
            @Value("${app.gemini.model}") String model
    ) {
        this.apiKey = apiKey;
        this.model = model;
    }

    public String generateResult(String prompt) {
        final int maxRetries = 3;
        int retryCount = 0;
        String lastError = null;

        while (retryCount < maxRetries) {
            try {
                String raw = callGemini(prompt);

                // Strip ```json / ``` fences, matching the Node cleanup.
                String cleaned = raw
                        .replace("```json", "")
                        .replace("```", "")
                        .trim();

                // (Node only warns if not valid JSON; it still returns the text.)
                return cleaned;
            } catch (Exception e) {
                lastError = e.getMessage() == null ? "Unknown API error" : e.getMessage();
                boolean overloaded = lastError.contains("503") && lastError.contains("overloaded");
                boolean rateLimited = lastError.contains("429");

                if (overloaded || rateLimited) {
                    retryCount++;
                    long delay = (long) Math.pow(2, retryCount) * 1000L;
                    System.out.printf("API %s. Retry %d/%d after %dms...%n",
                            rateLimited ? "rate-limited (429)" : "overloaded (503)",
                            retryCount, maxRetries, delay);
                    try {
                        Thread.sleep(delay);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                    }
                } else {
                    break; // non-retryable
                }
            }
        }

        // Graceful fallback (same JSON shape as the Node backend).
        System.err.println("Error in AI service: " + lastError);
        try {
            return mapper.writeValueAsString(Map.of(
                    "text", "I'm sorry, but I'm currently experiencing high demand. Please try again in a few moments.",
                    "error", lastError == null ? "Unknown error" : lastError
            ));
        } catch (Exception e) {
            return "{\"text\":\"I'm sorry, but I'm currently experiencing high demand. Please try again in a few moments.\"}";
        }
    }

    private String callGemini(String prompt) {
        String url = BASE_URL + "/" + model + ":generateContent?key=" + apiKey;

        Map<String, Object> body = Map.of(
                "systemInstruction", Map.of(
                        "parts", List.of(Map.of("text", GeminiSystemPrompt.INSTRUCTION))
                ),
                "contents", List.of(Map.of(
                        "parts", List.of(Map.of("text", prompt))
                ))
        );

        String response = webClient.post()
                .uri(url)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(body)
                .retrieve()
                .bodyToMono(String.class)
                .block();

        try {
            JsonNode root = mapper.readTree(response);
            // candidates[0].content.parts[0].text
            return root.path("candidates").path(0)
                    .path("content").path("parts").path(0)
                    .path("text").asText();
        } catch (Exception e) {
            throw new RuntimeException("Failed to parse Gemini response: " + e.getMessage(), e);
        }
    }
}
