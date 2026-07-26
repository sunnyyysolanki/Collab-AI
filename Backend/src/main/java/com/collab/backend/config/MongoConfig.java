package com.collab.backend.config;

import jakarta.annotation.PostConstruct;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.core.convert.MappingMongoConverter;

@Configuration
public class MongoConfig {

    private final MappingMongoConverter mappingMongoConverter;

    public MongoConfig(MappingMongoConverter mappingMongoConverter) {
        this.mappingMongoConverter = mappingMongoConverter;
    }

    @PostConstruct
    public void setUpMongoEscapeCharacterConversion() {
        // This allows map keys (like filenames "index.js") to contain dots (.)
        // Spring Data MongoDB strictly forbids dots in map keys by default.
        // We set a replacement character so it can safely save files to the database.
        mappingMongoConverter.setMapKeyDotReplacement("_dot_");
    }
}
