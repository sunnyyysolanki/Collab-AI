package com.collab.backend.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Date;

/**
 * Produces/verifies JWTs that are interchangeable with the Node backend's
 * jsonwebtoken output: HS256, claims { userId, email }, 24h expiry, same secret.
 */
@Component
public class JwtUtil {

    private final SecretKey key;
    private final long expirationMs;

    public JwtUtil(
            @Value("${app.jwt.secret}") String secret,
            @Value("${app.jwt.expiration-ms}") long expirationMs
    ) {
        // Node's jsonwebtoken accepts ANY secret length for HS256. jjwt's
        // Keys.hmacShaKeyFor() enforces the RFC 7518 >=256-bit minimum and would
        // reject a short secret. We build the key from the raw UTF-8 bytes via
        // SecretKeySpec so the HMAC is byte-identical to Node's — keeping tokens
        // interchangeable between the two backends even with a short SECRET_KEY.
        this.key = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        this.expirationMs = expirationMs;
    }

    public String generateToken(String userId, String email) {
        Date now = new Date();
        Date exp = new Date(now.getTime() + expirationMs);
        return Jwts.builder()
                .claim("userId", userId)
                .claim("email", email)
                .issuedAt(now)
                .expiration(exp)
                .signWith(key, Jwts.SIG.HS256) // pin HS256; matches Node default
                .compact();
    }

    public Claims parse(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public String getUserId(String token) {
        return parse(token).get("userId", String.class);
    }

    public String getEmail(String token) {
        return parse(token).get("email", String.class);
    }
}
