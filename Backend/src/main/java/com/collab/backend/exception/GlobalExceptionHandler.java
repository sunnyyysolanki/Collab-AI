package com.collab.backend.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Translates thrown exceptions into the JSON error shapes the frontend's
 * error handling expects:
 *  - validation errors  -> 400 { "message": "...", "errors": [ { "field", "msg" }, ... ] }
 *  - ApiException       -> status { "message": "..." }
 *  - anything else      -> 500 { "message": "..." }
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<?> handleValidation(MethodArgumentNotValidException ex) {
        // `field` lets the client mark the offending input inline; `message`
        // means a caller that only reads .message still gets something useful.
        List<Map<String, String>> errors = ex.getBindingResult().getFieldErrors().stream()
                .map(fe -> Map.of(
                        "field", fe.getField(),
                        "msg", fe.getDefaultMessage() == null ? "Invalid" : fe.getDefaultMessage()))
                .toList();

        String summary = errors.isEmpty()
                ? "Some of the details you entered aren't valid."
                : errors.get(0).get("msg");

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", summary);
        body.put("errors", errors);
        return ResponseEntity.badRequest().body(body);
    }

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<?> handleApi(ApiException ex) {
        return ResponseEntity.status(ex.getStatusCode())
                .body(Map.of("message", ex.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<?> handleGeneric(Exception ex) {
        System.err.println("[GlobalExceptionHandler] Unexpected: " + ex.getMessage());
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("message", "Something went wrong"));
    }
}
