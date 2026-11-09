package com.example.coffeeorder.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TwosomeAutoReloginGuardTest {

    @Mock
    private StringRedisTemplate stringRedisTemplate;
    @Mock
    private ValueOperations<String, String> valueOperations;

    private TwosomeAutoReloginGuard guard;

    @BeforeEach
    void setUp() {
        guard = new TwosomeAutoReloginGuard(stringRedisTemplate);
        when(stringRedisTemplate.opsForValue()).thenReturn(valueOperations);
    }

    @Test
    void failsClosedWhenRedisCannotReadBlockState() {
        when(valueOperations.get("twosome:auto-relogin:blocked:rep:7"))
                .thenThrow(new RuntimeException("Redis unavailable"));

        assertThat(guard.blockedReason("rep:7")).isPresent();
    }

    @Test
    void localBlockPreventsAttemptsEvenWhenRedisWriteFails() {
        org.mockito.Mockito.doThrow(new RuntimeException("Redis unavailable"))
                .when(valueOperations).set(org.mockito.ArgumentMatchers.anyString(),
                        org.mockito.ArgumentMatchers.anyString());

        guard.block("rep:7", "비밀번호 변경 확인 필요");

        assertThat(guard.blockedReason("rep:7")).contains("비밀번호 변경 확인 필요");
    }
}
