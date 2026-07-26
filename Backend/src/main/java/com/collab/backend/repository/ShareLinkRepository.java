package com.collab.backend.repository;

import com.collab.backend.model.ShareLink;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface ShareLinkRepository extends MongoRepository<ShareLink, String> {
    Optional<ShareLink> findByToken(String token);
}
