package com.collab.backend.exception;

/**
 * Mirrors the Node CustomError (message + HTTP status).
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
