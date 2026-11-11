package com.example.coffeeorder.config;

import org.junit.jupiter.api.Test;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.http.server.ServletServerHttpResponse;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;

class RequestTimingAdviceTest {

    @Test
    void writesApplicationAndExternalTimeBeforeTheResponseBody() {
        MockHttpServletRequest servletRequest = new MockHttpServletRequest("GET", "/api/twosome/menus/10100001/options");
        RequestTimingSupport.initialize(servletRequest);
        servletRequest.setAttribute(RequestTimingSupport.TWOSOME_ATTRIBUTE, 25_000_000L);
        ServletServerHttpRequest request = new ServletServerHttpRequest(servletRequest);
        MockHttpServletResponse servletResponse = new MockHttpServletResponse();
        ServletServerHttpResponse response = new ServletServerHttpResponse(servletResponse);

        new RequestTimingAdvice().beforeBodyWrite(null, null, null, null, request, response);

        assertThat(response.getHeaders().getFirst("Server-Timing"))
                .startsWith("app;dur=")
                .contains(", twosome;dur=25");
    }
}
