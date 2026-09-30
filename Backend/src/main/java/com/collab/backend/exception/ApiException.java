package com.collab.backend.exception;

/**
 * Runtime exception carrying a message and an HTTP status code, translated
 * into an error response by GlobalExceptionHandler.
 */
public class ApiException extends RuntimeException {
    private final int statusCode;

    public ApiException(String message, int statusCode) {
        super(message);
        this.statusCode = statusCode;
    }

    public int getStatusCode() {
        return statusCode;
    }
}
