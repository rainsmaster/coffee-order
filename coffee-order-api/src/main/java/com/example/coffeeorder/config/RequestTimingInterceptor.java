package com.example.coffeeorder.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.Nullable;
import org.springframework.web.servlet.HandlerInterceptor;

public class RequestTimingInterceptor implements HandlerInterceptor {

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        RequestTimingSupport.initialize(request);
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler,
                                @Nullable Exception exception) {
        if (response.getHeader("Server-Timing") == null && !response.isCommitted()) {
            response.setHeader("Server-Timing", RequestTimingSupport.serverTiming(request));
        }
    }
}
