package com.collab.backend.repository;

import com.collab.backend.model.Project;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface ProjectRepository extends MongoRepository<Project, String> {
    List<Project> findByIdIn(List<String> ids);
}
