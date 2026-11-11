package com.example.coffeeorder.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Set;

@Component
public class StaticContentCacheFilter extends OncePerRequestFilter {

    private static final Set<String> NO_CACHE_PATHS = Set.of(
            "/", "/index.html", "/service-worker.js", "/offline.html", "/manifest.json"
    );

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String path = request.getRequestURI();
        if (NO_CACHE_PATHS.contains(path)) {
            response.setHeader(HttpHeaders.CACHE_CONTROL, CacheControl.noStore().getHeaderValue());
        } else if (path.startsWith("/static/") || path.startsWith("/images/twosome/")) {
            response.setHeader(HttpHeaders.CACHE_CONTROL,
                    CacheControl.maxAge(java.time.Duration.ofDays(365)).cachePublic().immutable().getHeaderValue());
        }
        filterChain.doFilter(request, response);
        if (response.getStatus() >= 400) {
            response.setHeader(HttpHeaders.CACHE_CONTROL, CacheControl.noStore().getHeaderValue());
        }
    }
}
