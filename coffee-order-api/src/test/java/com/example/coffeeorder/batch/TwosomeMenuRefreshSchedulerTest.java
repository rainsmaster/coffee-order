package com.example.coffeeorder.batch;

import com.example.coffeeorder.service.DistributedLockService;
import com.example.coffeeorder.service.TwosomeStoreIntegrationService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TwosomeMenuRefreshSchedulerTest {

    @Mock
    private TwosomeStoreIntegrationService integrationService;
    @Mock
    private DistributedLockService lockService;

    @Test
    void refreshesMenusAndPrewarmsConfiguredNumberOfOptions() {
        TwosomeMenuRefreshScheduler scheduler = new TwosomeMenuRefreshScheduler(integrationService, lockService);
        ReflectionTestUtils.setField(scheduler, "prewarmLimit", 10);
        when(lockService.tryAcquireSyncLock()).thenReturn(true);
        when(integrationService.refreshStoreMenus()).thenReturn(200);
        when(integrationService.prewarmMenuOptions(10)).thenReturn(8);

        scheduler.refreshStoreMenus();

        verify(integrationService).refreshStoreMenus();
        verify(integrationService).prewarmMenuOptions(10);
        verify(lockService).releaseSyncLock();
    }

    @Test
    void skipsRefreshAndPrewarmWhenAnotherJobOwnsTheLock() {
        TwosomeMenuRefreshScheduler scheduler = new TwosomeMenuRefreshScheduler(integrationService, lockService);
        when(lockService.tryAcquireSyncLock()).thenReturn(false);

        scheduler.refreshStoreMenus();

        verify(integrationService, never()).refreshStoreMenus();
        verify(integrationService, never()).prewarmMenuOptions(org.mockito.ArgumentMatchers.anyInt());
        verify(lockService, never()).releaseSyncLock();
    }
}
