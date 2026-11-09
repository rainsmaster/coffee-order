package com.example.coffeeorder.service;

import com.example.coffeeorder.client.TwosomeOcrClient;
import com.example.coffeeorder.dto.TwosomeAutoReloginResult;
import com.example.coffeeorder.dto.TwosomeCaptchaResponse;
import com.example.coffeeorder.dto.TwosomeLoginRequest;
import com.example.coffeeorder.dto.TwosomeLoginResponse;
import com.example.coffeeorder.exception.AuthException;
import com.example.coffeeorder.exception.TwosomeStoreException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Base64;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TwosomeAutoReloginServiceTest {

    @Mock
    private TwosomeStoreIntegrationService integrationService;
    @Mock
    private TwosomeOcrClient ocrClient;
    @Mock
    private TwosomeHealthService healthService;
    @Mock
    private RepAuthService repAuthService;
    @Mock
    private TwosomeAutoReloginGuard autoReloginGuard;

    private TwosomeAutoReloginService service;

    @BeforeEach
    void setUp() {
        service = new TwosomeAutoReloginService(
                integrationService, ocrClient, healthService, repAuthService, autoReloginGuard);
        ReflectionTestUtils.setField(service, "adminId", "admin-user");
        ReflectionTestUtils.setField(service, "adminPw", "admin-password");
        ReflectionTestUtils.setField(service, "requestIntervalMs", 0L);
    }

    @Test
    void blocksCredentialRejectionAcrossLaterAttempts() {
        when(autoReloginGuard.blockedReason("active"))
                .thenReturn(Optional.empty(), Optional.of("blocked"));
        prepareCaptcha();
        when(integrationService.login(any()))
                .thenReturn(new TwosomeLoginResponse("FAILED", "비밀번호 오류", "5556"));

        TwosomeAutoReloginResult first = service.autoLogin();
        TwosomeAutoReloginResult second = service.autoLogin();

        assertThat(first.isSuccess()).isFalse();
        assertThat(first.getAttempts()).isEqualTo(1);
        assertThat(second.getAttempts()).isZero();
        verify(autoReloginGuard).block(eq("active"), any());
        verify(integrationService, times(1)).issueCaptcha();
        verify(integrationService, times(1)).login(any());
    }

    @Test
    void retriesCaptchaFailureAndClearsBlockOnSuccess() {
        when(autoReloginGuard.blockedReason("active")).thenReturn(Optional.empty());
        prepareCaptcha();
        when(integrationService.login(any()))
                .thenReturn(new TwosomeLoginResponse("FAILED", "캡차 오류", "5557"))
                .thenReturn(new TwosomeLoginResponse("SUCCESS", "로그인 성공", "000"));

        TwosomeAutoReloginResult result = service.autoLogin();

        assertThat(result.isSuccess()).isTrue();
        assertThat(result.getAttempts()).isEqualTo(2);
        verify(integrationService, times(2)).login(any());
        verify(autoReloginGuard, never()).block(any(), any());
        verify(autoReloginGuard).clear("active");
    }

    @Test
    void doesNotBlockTransientLoginFailure() {
        when(autoReloginGuard.blockedReason("active")).thenReturn(Optional.empty());
        prepareCaptcha();
        when(integrationService.login(any()))
                .thenReturn(new TwosomeLoginResponse("FAILED", "네트워크 오류", null));

        assertThatThrownBy(() -> service.autoLogin()).isInstanceOf(TwosomeStoreException.class);

        verify(autoReloginGuard, never()).block(any(), any());
    }

    @Test
    void representativeUsesOwnCredentials() {
        when(autoReloginGuard.blockedReason("rep:7")).thenReturn(Optional.empty());
        when(repAuthService.requireTwosomeCredentialsForAutoLogin(7L))
                .thenReturn(new RepAuthService.TwosomeCredentials(7L, "rep-user", "rep-password"));
        prepareCaptcha();
        when(integrationService.loginForRep(eq(7L), any()))
                .thenReturn(new TwosomeLoginResponse("SUCCESS", "로그인 성공", "000"));

        TwosomeAutoReloginResult result = service.autoLoginForRep(7L);

        assertThat(result.isSuccess()).isTrue();
        verify(integrationService).loginForRep(eq(7L), any(TwosomeLoginRequest.class));
        verify(integrationService, never()).login(any());
        verify(autoReloginGuard).clear("rep:7");
    }

    @Test
    void missingRepresentativeAccountBlocksWithoutCaptcha() {
        when(autoReloginGuard.blockedReason("rep:7")).thenReturn(Optional.empty());
        when(repAuthService.requireTwosomeCredentialsForAutoLogin(7L))
                .thenThrow(new AuthException("NO_TWOSOME_ACCOUNT", "계정 없음"));

        TwosomeAutoReloginResult result = service.autoLoginForRep(7L);

        assertThat(result.isSuccess()).isFalse();
        assertThat(result.getAttempts()).isZero();
        verify(autoReloginGuard).block(eq("rep:7"), any());
        verify(integrationService, never()).issueCaptcha();
    }

    @Test
    void ocrFailureDoesNotBlockCredentials() {
        when(autoReloginGuard.blockedReason("active")).thenReturn(Optional.empty());
        when(integrationService.issueCaptcha()).thenAnswer(invocation -> captcha());
        when(ocrClient.recognizeCaptcha(any())).thenReturn(null);

        TwosomeAutoReloginResult result = service.autoLogin();

        assertThat(result.isSuccess()).isFalse();
        assertThat(result.getAttempts()).isEqualTo(4);
        verify(integrationService, times(4)).issueCaptcha();
        verify(integrationService, never()).login(any());
        verify(autoReloginGuard, never()).block(any(), any());
    }

    @Test
    void credentialDecryptionFailureBlocksWithoutCaptcha() {
        when(autoReloginGuard.blockedReason("rep:7")).thenReturn(Optional.empty());
        when(repAuthService.requireTwosomeCredentialsForAutoLogin(7L))
                .thenThrow(new IllegalStateException("자격증명 복호화 실패"));

        TwosomeAutoReloginResult result = service.autoLoginForRep(7L);

        assertThat(result.isSuccess()).isFalse();
        assertThat(result.getAttempts()).isZero();
        verify(autoReloginGuard).block(eq("rep:7"), any());
        verify(integrationService, never()).issueCaptcha();
    }

    @Test
    void httpAuthenticationRejectionBlocksFurtherCaptchaRequests() {
        when(autoReloginGuard.blockedReason("active"))
                .thenReturn(Optional.empty(), Optional.of("blocked"));
        when(integrationService.issueCaptcha())
                .thenThrow(new TwosomeStoreException("투썸 서버가 오류를 반환했습니다. (HTTP 403)"));

        TwosomeAutoReloginResult first = service.autoLogin();
        TwosomeAutoReloginResult second = service.autoLogin();

        assertThat(first.isSuccess()).isFalse();
        assertThat(second.getAttempts()).isZero();
        verify(autoReloginGuard).block(eq("active"), any());
        verify(integrationService, times(1)).issueCaptcha();
    }

    private void prepareCaptcha() {
        when(integrationService.issueCaptcha()).thenAnswer(invocation -> captcha());
        when(ocrClient.recognizeCaptcha(any())).thenReturn("123456");
    }

    private TwosomeCaptchaResponse captcha() {
        String image = Base64.getEncoder().encodeToString(new byte[]{1});
        return new TwosomeCaptchaResponse("context-id", "data:image/png;base64," + image);
    }
}
