package com.example.coffeeorder.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TwosomeMenuCustomOptionsCacheTest {

    private final TwosomeStoreIntegrationService integrationService = mock(TwosomeStoreIntegrationService.class);
    private final TwosomeMenuOptionService service = new TwosomeMenuOptionService(
            null, integrationService, new ObjectMapper());

    @Test
    void reusesParsedCustomOptionsUntilTheMenuRefreshClearsThem() {
        when(integrationService.getMenuCustomOptionsHtml("active", "variant-1")).thenReturn("");

        assertThat(service.getMenuCustomOptions("active", "variant-1").path("hasCustom").asBoolean()).isFalse();
        service.getMenuCustomOptions("active", "variant-1");
        verify(integrationService, times(1)).getMenuCustomOptionsHtml("active", "variant-1");

        service.clearCustomOptionsCache();
        service.getMenuCustomOptions("active", "variant-1");
        verify(integrationService, times(2)).getMenuCustomOptionsHtml("active", "variant-1");
    }
}
