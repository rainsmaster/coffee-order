package com.example.coffeeorder.controller;

import com.example.coffeeorder.dto.TwosomeCartAddRequest;
import com.example.coffeeorder.dto.TwosomeCartAddResponse;
import com.example.coffeeorder.dto.TwosomeSessionResponse;
import com.example.coffeeorder.entity.Member;
import com.example.coffeeorder.exception.AuthException;
import com.example.coffeeorder.repository.MemberRepository;
import com.example.coffeeorder.service.RepAuthService;
import com.example.coffeeorder.service.TwosomeStoreIntegrationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RepControllerTest {

    @Mock
    private RepAuthService repAuthService;
    @Mock
    private MemberRepository memberRepository;
    @Mock
    private TwosomeStoreIntegrationService integrationService;

    private RepController controller;

    @BeforeEach
    void setUp() {
        controller = new RepController(repAuthService, memberRepository, integrationService);
    }

    @Test
    void selectedRepresentativeSessionIsUsedWithoutSharingToken() {
        Member member = new Member();
        member.setId(42L);
        String sessionKey = TwosomeStoreIntegrationService.repSessionKey(42L);
        when(repAuthService.requireActiveMember(42L)).thenReturn(member);
        when(integrationService.getSessionStatus(sessionKey))
                .thenReturn(new TwosomeSessionResponse("ACTIVE", "테스트점", null, 20L, null));
        TwosomeCartAddRequest request = new TwosomeCartAddRequest();
        request.setTargetRepMemberId(42L);
        request.setItems(List.of());
        when(integrationService.addItemsToCart(sessionKey, request))
                .thenReturn(new TwosomeCartAddResponse(0, 0, 0, List.of()));

        controller.addToCart(null, request);

        verify(integrationService).addItemsToCart(sessionKey, request);
        verify(repAuthService, never()).resolveByToken(null);
    }

    @Test
    void inactiveRepresentativeCannotReceiveCartItems() {
        Member member = new Member();
        member.setId(42L);
        String sessionKey = TwosomeStoreIntegrationService.repSessionKey(42L);
        when(repAuthService.requireActiveMember(42L)).thenReturn(member);
        when(integrationService.getSessionStatus(sessionKey))
                .thenReturn(new TwosomeSessionResponse("EXPIRED", "테스트점", null, 0L, null));
        TwosomeCartAddRequest request = new TwosomeCartAddRequest();
        request.setTargetRepMemberId(42L);

        assertThatThrownBy(() -> controller.addToCart(null, request))
                .isInstanceOf(AuthException.class)
                .extracting("errorCode").isEqualTo("TARGET_REP_SESSION_REQUIRED");
        verify(integrationService, never()).addItemsToCart(sessionKey, request);
    }
}
