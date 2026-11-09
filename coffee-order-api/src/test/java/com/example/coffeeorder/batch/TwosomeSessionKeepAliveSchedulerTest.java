package com.example.coffeeorder.batch;

import com.example.coffeeorder.dto.TwosomeAutoReloginResult;
import com.example.coffeeorder.exception.TwosomeStoreException;
import com.example.coffeeorder.exception.TwosomeStoreSessionExpiredException;
import com.example.coffeeorder.service.TwosomeAutoReloginService;
import com.example.coffeeorder.service.TwosomeHealthService;
import com.example.coffeeorder.service.TwosomeStoreIntegrationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TwosomeSessionKeepAliveSchedulerTest {

    @Mock
    private TwosomeStoreIntegrationService integrationService;
    @Mock
    private TwosomeAutoReloginService autoReloginService;
    @Mock
    private TwosomeHealthService healthService;

    private TwosomeSessionKeepAliveScheduler scheduler;

    @BeforeEach
    void setUp() {
        scheduler = new TwosomeSessionKeepAliveScheduler(integrationService, autoReloginService, healthService);
    }

    @Test
    void expiredRepresentativeTriggersOwnAutoRelogin() {
        when(integrationService.keepAliveSession()).thenReturn(false);
        when(integrationService.getRepSessionMemberIds()).thenReturn(List.of(7L));
        when(integrationService.keepAliveRepSession(7L))
                .thenThrow(new TwosomeStoreSessionExpiredException("401"));
        when(autoReloginService.autoLoginForRep(7L))
                .thenReturn(new TwosomeAutoReloginResult(true, 1, "성공"));

        scheduler.keepAlive();

        verify(autoReloginService).autoLoginForRep(7L);
    }

    @Test
    void transientRepresentativeFailureDoesNotTriggerAutoRelogin() {
        when(integrationService.keepAliveSession()).thenReturn(false);
        when(integrationService.getRepSessionMemberIds()).thenReturn(List.of(7L));
        when(integrationService.keepAliveRepSession(7L))
                .thenThrow(new TwosomeStoreException("네트워크 오류"));

        scheduler.keepAlive();

        verify(autoReloginService, never()).autoLoginForRep(7L);
    }

    @Test
    void expiredAdminKeepsExistingAutoReloginFlow() {
        when(integrationService.keepAliveSession())
                .thenThrow(new TwosomeStoreSessionExpiredException("401"));
        when(integrationService.getRepSessionMemberIds()).thenReturn(List.of());
        when(autoReloginService.autoLogin()).thenReturn(new TwosomeAutoReloginResult(true, 1, "성공"));

        scheduler.keepAlive();

        verify(autoReloginService).autoLogin();
    }
}
