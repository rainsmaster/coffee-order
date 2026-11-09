package com.example.coffeeorder.config;

import org.junit.jupiter.api.Test;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;

class StaticContentCacheFilterTest {

    @Test
    void disablesHttpCacheForHtmlAndServiceWorker() throws Exception {
        assertThat(filter("/")).isEqualTo(CacheControl.noStore().getHeaderValue());
        assertThat(filter("/index.html")).isEqualTo(CacheControl.noStore().getHeaderValue());
        assertThat(filter("/service-worker.js")).isEqualTo(CacheControl.noStore().getHeaderValue());
    }

    @Test
    void preservesCachingForHashedAssetsAndApi() throws Exception {
        assertThat(filter("/static/js/main.9a943929.js")).isNull();
        assertThat(filter("/api/departments")).isNull();
    }

    private String filter(String path) throws Exception {
        StaticContentCacheFilter filter = new StaticContentCacheFilter();
        MockHttpServletRequest request = new MockHttpServletRequest("GET", path);
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, (servletRequest, servletResponse) -> { });
        return response.getHeader(HttpHeaders.CACHE_CONTROL);
    }
}
