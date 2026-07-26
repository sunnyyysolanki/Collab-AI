package com.collab.backend.config;

import com.collab.backend.security.JwtAuthFilter;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Registers the JWT filter for all requests. shouldNotFilter() inside the
 * filter exempts public paths (register/login) and OPTIONS preflight.
 */
@Configuration
public class FilterConfig {

    @Bean
    public FilterRegistrationBean<JwtAuthFilter> jwtFilterRegistration(JwtAuthFilter filter) {
        FilterRegistrationBean<JwtAuthFilter> reg = new FilterRegistrationBean<>(filter);
        reg.addUrlPatterns("/users/*", "/project/*", "/ai/*", "/git/*");
        reg.setOrder(1);
        return reg;
    }
}
