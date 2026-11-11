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
import java.time.Duration;
import java.util.Set;

@Component
public class ApiCacheControlFilter extends OncePerRequestFilter {

    private static final Set<String> PUBLIC_READ_PATHS = Set.of(
            "/api/twosome-menus", "/api/departments", "/api/twosome/store-info"
    );

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        boolean publicRead = "GET".equals(request.getMethod()) && PUBLIC_READ_PATHS.contains(request.getRequestURI());
        CacheControl cacheControl = publicRead
                ? CacheControl.maxAge(Duration.ofSeconds(60)).cachePublic().staleWhileRevalidate(Duration.ofSeconds(30))
                : CacheControl.noStore();
        response.setHeader(HttpHeaders.CACHE_CONTROL, cacheControl.getHeaderValue());
        filterChain.doFilter(request, response);
    }
}
