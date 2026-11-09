package com.example.coffeeorder.service;

import com.example.coffeeorder.client.TwosomeStoreApiClient;
import com.example.coffeeorder.dto.TwosomeCaptchaResponse;
import com.example.coffeeorder.dto.TwosomeLoginRequest;
import com.example.coffeeorder.repository.OrderRepository;
import com.example.coffeeorder.repository.TwosomeMenuRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class TwosomeSessionPersistenceIntegrationTest {

    private static final long MEMBER_ID = 777L;
    private static final String SESSION_KEY = "rep:777";
    private static final String REDIS_KEY = "twosome:session:rep:777";
    private static final String BLOCKED_KEY = "twosome:auto-relogin:blocked:rep:777";

    private LettuceConnectionFactory connectionFactory;
    private StringRedisTemplate redisTemplate;
    private TwosomeAutoReloginGuard guard;
    private TwosomeStoreApiClient apiClient;
    private TwosomeStoreIntegrationService firstService;

    @BeforeEach
    void setUp() {
        String host = System.getProperty("spring.data.redis.host", "localhost");
        int port = Integer.parseInt(System.getProperty("spring.data.redis.port", "6379"));
        connectionFactory = new LettuceConnectionFactory(host, port);
        connectionFactory.afterPropertiesSet();
        redisTemplate = new StringRedisTemplate();
        redisTemplate.setConnectionFactory(connectionFactory);
        redisTemplate.afterPropertiesSet();
        redisTemplate.delete(REDIS_KEY);
        redisTemplate.delete(BLOCKED_KEY);

        ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();
        TwosomeSessionRedisStore sessionStore = new TwosomeSessionRedisStore(redisTemplate, objectMapper);
        guard = new TwosomeAutoReloginGuard(redisTemplate);
        apiClient = mock(TwosomeStoreApiClient.class);
        when(apiClient.fetchCaptchaImage(any())).thenReturn(new byte[]{1});
        when(apiClient.login(any(), org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString()))
                .thenAnswer(invocation -> {
                    com.example.coffeeorder.client.TwosomeStoreSessionContext context = invocation.getArgument(0);
                    context.getCookieJar().put("session", "cookie");
                    return true;
                });
        when(apiClient.setStoreInfo(any(), eq("1102115"), anyDouble(), anyDouble()))
                .thenReturn("CJENM커머스부문점");

        firstService = new TwosomeStoreIntegrationService(
                apiClient,
                mock(TwosomeMenuRepository.class),
                mock(OrderRepository.class),
                objectMapper,
                sessionStore,
                mock(TwosomeHealthService.class),
                guard,
                redisTemplate,
                mock(ObjectProvider.class));
    }

    @AfterEach
    void tearDown() {
        redisTemplate.delete(REDIS_KEY);
        redisTemplate.delete(BLOCKED_KEY);
        connectionFactory.destroy();
    }

    @Test
    void restoresRepresentativeSessionAndGuardStateAcrossInstances() {
        guard.block(SESSION_KEY, "이전 로그인 거부");
        TwosomeCaptchaResponse captcha = firstService.issueCaptcha();
        firstService.loginForRep(MEMBER_ID,
                new TwosomeLoginRequest(captcha.getContextId(), "rep-user", "password", "123456"));

        assertThat(guard.blockedReason(SESSION_KEY)).isEmpty();
        assertThat(redisTemplate.getExpire(REDIS_KEY)).isBetween(
                Duration.ofHours(23).plusMinutes(59).getSeconds(), Duration.ofHours(24).getSeconds());

        TwosomeSessionRedisStore restoredStore = new TwosomeSessionRedisStore(
                redisTemplate, new ObjectMapper().findAndRegisterModules());
        TwosomeStoreIntegrationService secondService = new TwosomeStoreIntegrationService(
                apiClient,
                mock(TwosomeMenuRepository.class),
                mock(OrderRepository.class),
                new ObjectMapper().findAndRegisterModules(),
                restoredStore,
                mock(TwosomeHealthService.class),
                new TwosomeAutoReloginGuard(redisTemplate),
                redisTemplate,
                mock(ObjectProvider.class));
        secondService.restoreSessionFromRedis();

        assertThat(secondService.getSessionStatus(SESSION_KEY).getStatus()).isEqualTo("ACTIVE");
        assertThat(secondService.getSessionStatus(SESSION_KEY).getSource()).isEqualTo("RESTORED");
        assertThat(secondService.keepAliveRepSession(MEMBER_ID)).isTrue();

        guard.block(SESSION_KEY, "비밀번호 변경 확인 필요");
        TwosomeAutoReloginGuard restartedGuard = new TwosomeAutoReloginGuard(redisTemplate);
        assertThat(restartedGuard.blockedReason(SESSION_KEY)).contains("비밀번호 변경 확인 필요");
    }
}
