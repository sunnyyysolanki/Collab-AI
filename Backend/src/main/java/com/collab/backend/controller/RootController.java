package com.collab.backend.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Health-check route: GET / returns a plain-text "hello". */
@RestController
public class RootController {

    @GetMapping("/")
    public String hello() {
        return "hello";
    }
}
