package com.example.coffeeorder.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;

class RequestTimingInterceptorTest {

    @Test
    void initializesTimingAttributesBeforeControllerExecution() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/twosome/menus/10100001/options");
        MockHttpServletResponse response = new MockHttpServletResponse();
        RequestTimingInterceptor interceptor = new RequestTimingInterceptor();

        interceptor.preHandle(request, response, new Object());

        assertThat(request.getAttribute(RequestTimingSupport.START_ATTRIBUTE)).isInstanceOf(Long.class);
        assertThat(request.getAttribute(RequestTimingSupport.TWOSOME_ATTRIBUTE)).isEqualTo(0L);
    }
}
