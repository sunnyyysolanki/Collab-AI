package com.collab.backend.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Ports the Node `app.get('/', ...)` health route. */
@RestController
public class RootController {

    @GetMapping("/")
    public String hello() {
        return "hello";
    }
}
