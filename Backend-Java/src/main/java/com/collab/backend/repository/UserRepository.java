package com.collab.backend.repository;

import com.collab.backend.model.User;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends MongoRepository<User, String> {
    Optional<User> findByEmail(String email);

    // Equivalent to Prisma findMany({ where: { id: { not: userId } } })
    List<User> findByIdNot(String id);
}
