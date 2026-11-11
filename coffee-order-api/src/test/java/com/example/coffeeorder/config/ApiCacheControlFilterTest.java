package com.example.coffeeorder.config;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class ApiCacheControlFilterTest {

    private final ApiCacheControlFilter filter = new ApiCacheControlFilter();

    @Test
    void cachesOnlyApprovedPublicReadRequests() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/twosome-menus");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, mock(FilterChain.class));

        assertThat(response.getHeader("Cache-Control")).contains("max-age=60", "public", "stale-while-revalidate=30");
    }

    @Test
    void preventsSharedCachingOfOrdersAndAuthenticatedRequests() throws Exception {
        MockHttpServletRequest orderRequest = new MockHttpServletRequest("GET", "/api/orders/today");
        MockHttpServletResponse orderResponse = new MockHttpServletResponse();
        filter.doFilter(orderRequest, orderResponse, mock(FilterChain.class));

        MockHttpServletRequest postRequest = new MockHttpServletRequest("POST", "/api/departments");
        MockHttpServletResponse postResponse = new MockHttpServletResponse();
        filter.doFilter(postRequest, postResponse, mock(FilterChain.class));

        assertThat(orderResponse.getHeader("Cache-Control")).isEqualTo("no-store");
        assertThat(postResponse.getHeader("Cache-Control")).isEqualTo("no-store");
    }
}
