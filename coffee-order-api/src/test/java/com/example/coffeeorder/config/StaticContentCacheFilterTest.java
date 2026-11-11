package com.example.coffeeorder.config;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class StaticContentCacheFilterTest {

    private final StaticContentCacheFilter filter = new StaticContentCacheFilter();

    @Test
    void cachesVersionedAssetsForOneYear() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/static/js/main.1234.js");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, mock(FilterChain.class));

        assertThat(response.getHeader("Cache-Control"))
                .contains("max-age=31536000", "public", "immutable");
    }

    @Test
    void keepsHtmlAndServiceWorkerUncached() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/service-worker.js");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, mock(FilterChain.class));

        assertThat(response.getHeader("Cache-Control")).isEqualTo("no-store");
    }
}
