package com.example.coffeeorder.config;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

public final class RequestTimingSupport {

    public static final String START_ATTRIBUTE = RequestTimingSupport.class.getName() + ".start";
    public static final String TWOSOME_ATTRIBUTE = RequestTimingSupport.class.getName() + ".twosome";

    private RequestTimingSupport() {
    }

    public static void recordTwosome(long durationNanos) {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes) {
            HttpServletRequest request = attributes.getRequest();
            Number previous = (Number) request.getAttribute(TWOSOME_ATTRIBUTE);
            request.setAttribute(TWOSOME_ATTRIBUTE,
                    (previous != null ? previous.longValue() : 0L) + durationNanos);
        }
    }

    public static void initialize(HttpServletRequest request) {
        request.setAttribute(START_ATTRIBUTE, System.nanoTime());
        request.setAttribute(TWOSOME_ATTRIBUTE, 0L);
    }

    public static String serverTiming(HttpServletRequest request) {
        Object start = request.getAttribute(START_ATTRIBUTE);
        if (!(start instanceof Long startNanos)) {
            return null;
        }
        long appMillis = (System.nanoTime() - startNanos) / 1_000_000;
        Number twosomeNanos = (Number) request.getAttribute(TWOSOME_ATTRIBUTE);
        long twosomeMillis = (twosomeNanos != null ? twosomeNanos.longValue() : 0L) / 1_000_000;
        return twosomeMillis > 0
                ? "app;dur=" + appMillis + ", twosome;dur=" + twosomeMillis
                : "app;dur=" + appMillis;
    }
}
