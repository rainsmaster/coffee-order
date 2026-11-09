package com.example.coffeeorder.controller;

import com.example.coffeeorder.dto.RepAdminItem;
import com.example.coffeeorder.dto.RepTwosomeVerifyResponse;
import com.example.coffeeorder.dto.TwosomeAutoReloginResult;
import com.example.coffeeorder.dto.TwosomeSessionResponse;
import com.example.coffeeorder.entity.Department;
import com.example.coffeeorder.entity.Member;
import com.example.coffeeorder.entity.Team;
import com.example.coffeeorder.exception.TwosomeStoreException;
import com.example.coffeeorder.exception.TwosomeStoreSessionExpiredException;
import com.example.coffeeorder.repository.MemberRepository;
import com.example.coffeeorder.repository.TeamRepository;
import com.example.coffeeorder.service.AdminAuthService;
import com.example.coffeeorder.service.TwosomeAutoReloginGuard;
import com.example.coffeeorder.service.TwosomeAutoReloginService;
import com.example.coffeeorder.service.TwosomeStoreIntegrationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminControllerTest {

    @Mock
    private AdminAuthService adminAuthService;
    @Mock
    private MemberRepository memberRepository;
    @Mock
    private TeamRepository teamRepository;
    @Mock
    private TwosomeStoreIntegrationService integrationService;
    @Mock
    private TwosomeAutoReloginService autoReloginService;
    @Mock
    private TwosomeAutoReloginGuard autoReloginGuard;
    @Mock
    private StringRedisTemplate stringRedisTemplate;
    @Mock
    private ValueOperations<String, String> valueOperations;

    private AdminController controller;

    @BeforeEach
    void setUp() {
        controller = new AdminController(adminAuthService, memberRepository, teamRepository,
                integrationService, autoReloginService, autoReloginGuard, stringRedisTemplate);
        org.mockito.Mockito.lenient().when(stringRedisTemplate.opsForValue()).thenReturn(valueOperations);
    }

    @Test
    void listIncludesTwosomeSessionMetadata() {
        Member member = member();
        when(memberRepository.findByDelYnOrderByIdAsc("N")).thenReturn(List.of(member));
        when(integrationService.getSessionStatus("rep:7")).thenReturn(session("ACTIVE"));
        when(autoReloginGuard.blockedReason("rep:7")).thenReturn(Optional.of("계정 확인 필요"));

        List<RepAdminItem> result = controller.getReps(null).getBody();

        assertThat(result).hasSize(1);
        RepAdminItem item = result.get(0);
        assertThat(item.getTwosomeStatus()).isEqualTo("ACTIVE");
        assertThat(item.getTwosomeStoreNm()).isEqualTo("CJENM커머스부문점");
        assertThat(item.getTwosomeLastVerifiedAt()).isNotNull();
        assertThat(item.getTwosomeSource()).isEqualTo("RESTORED");
        assertThat(item.isAutoReloginBlocked()).isTrue();
        assertThat(item.getAutoReloginMessage()).isEqualTo("계정 확인 필요");
    }

    @Test
    void verifiesActiveSessionWithRealCall() {
        TwosomeSessionResponse session = session("ACTIVE");
        expectMember(session);
        permit();
        when(integrationService.keepAliveRepSession(7L)).thenReturn(true);

        RepTwosomeVerifyResponse response = controller.verifyRepTwosome(7L).getBody();

        assertThat(response.getResult()).isEqualTo(RepTwosomeVerifyResponse.Result.VALID);
        assertThat(response.getRep().getTwosomeStatus()).isEqualTo("ACTIVE");
        verify(integrationService).keepAliveRepSession(7L);
        verify(autoReloginService, never()).autoLoginForRep(7L);
    }

    @Test
    void retriesExpiredSessionWithOcr() {
        expectMember(session("ACTIVE"));
        permit();
        when(integrationService.keepAliveRepSession(7L))
                .thenThrow(new TwosomeStoreSessionExpiredException("401"));
        when(autoReloginService.autoLoginForRep(7L))
                .thenReturn(new TwosomeAutoReloginResult(true, 1, "성공"));

        RepTwosomeVerifyResponse response = controller.verifyRepTwosome(7L).getBody();

        assertThat(response.getResult()).isEqualTo(RepTwosomeVerifyResponse.Result.RELOGINED);
        verify(autoReloginService).autoLoginForRep(7L);
    }

    @Test
    void returnsAutoReloginBlockReason() {
        expectMember(session("EXPIRED"));
        permit();
        when(integrationService.keepAliveRepSession(7L))
                .thenThrow(new TwosomeStoreSessionExpiredException("401"));
        when(autoReloginService.autoLoginForRep(7L))
                .thenReturn(new TwosomeAutoReloginResult(false, 0, "차단됨"));
        when(autoReloginGuard.blockedReason("rep:7")).thenReturn(Optional.of("비밀번호 확인 필요"));

        RepTwosomeVerifyResponse response = controller.verifyRepTwosome(7L).getBody();

        assertThat(response.getResult()).isEqualTo(RepTwosomeVerifyResponse.Result.BLOCKED);
        assertThat(response.getRep().isAutoReloginBlocked()).isTrue();
        assertThat(response.getMessage()).isEqualTo("비밀번호 확인 필요");
    }

    @Test
    void keepsExistingSessionOnNetworkFailure() {
        expectMember(session("ACTIVE"));
        permit();
        when(integrationService.keepAliveRepSession(7L))
                .thenThrow(new TwosomeStoreException("네트워크 오류"));

        RepTwosomeVerifyResponse response = controller.verifyRepTwosome(7L).getBody();

        assertThat(response.getResult()).isEqualTo(RepTwosomeVerifyResponse.Result.TEMPORARY_ERROR);
        assertThat(response.getRep().getTwosomeStatus()).isEqualTo("ACTIVE");
        verify(autoReloginService, never()).autoLoginForRep(7L);
    }

    @Test
    void appliesThirtySecondRateLimit() {
        expectMember(session("ACTIVE"));
        when(valueOperations.setIfAbsent(anyString(), anyString(), any(Duration.class))).thenReturn(false);

        RepTwosomeVerifyResponse response = controller.verifyRepTwosome(7L).getBody();

        assertThat(response.getResult()).isEqualTo(RepTwosomeVerifyResponse.Result.RATE_LIMITED);
        verify(integrationService, never()).keepAliveRepSession(7L);
    }

    @Test
    void missingSessionDoesNotTriggerOcr() {
        expectMember(session("NONE"));
        permit();
        when(integrationService.keepAliveRepSession(7L)).thenReturn(false);

        RepTwosomeVerifyResponse response = controller.verifyRepTwosome(7L).getBody();

        assertThat(response.getResult()).isEqualTo(RepTwosomeVerifyResponse.Result.NONE);
        verify(autoReloginService, never()).autoLoginForRep(7L);
    }

    private void expectMember(TwosomeSessionResponse session) {
        when(memberRepository.findByIdAndDelYn(7L, "N")).thenReturn(Optional.of(member()));
        when(integrationService.getSessionStatus("rep:7")).thenReturn(session);
        when(autoReloginGuard.blockedReason("rep:7")).thenReturn(Optional.empty());
    }

    private void permit() {
        when(valueOperations.setIfAbsent(anyString(), anyString(), any(Duration.class))).thenReturn(true);
    }

    private TwosomeSessionResponse session(String status) {
        return new TwosomeSessionResponse(status, "CJENM커머스부문점",
                LocalDateTime.now(), 20L, "RESTORED");
    }

    private Member member() {
        Department department = new Department();
        department.setId(2L);
        department.setName("MSA TF");
        Team team = new Team();
        team.setId(9L);
        team.setName("허규선");
        team.setDepartment(department);
        Member member = new Member();
        member.setId(7L);
        member.setName("허규선");
        member.setTeam(team);
        member.setPinSetAt(LocalDateTime.now());
        return member;
    }
}
