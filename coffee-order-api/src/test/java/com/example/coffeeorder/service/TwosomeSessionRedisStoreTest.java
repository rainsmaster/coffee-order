package com.example.coffeeorder.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TwosomeSessionRedisStoreTest {

    @Mock
    private StringRedisTemplate stringRedisTemplate;
    @Mock
    private ValueOperations<String, String> valueOperations;

    private TwosomeSessionRedisStore store;

    @BeforeEach
    void setUp() {
        store = new TwosomeSessionRedisStore(stringRedisTemplate, new ObjectMapper().findAndRegisterModules());
        when(stringRedisTemplate.opsForValue()).thenReturn(valueOperations);
    }

    @Test
    void savesRepresentativeSessionWithTwentyFourHourTtl() {
        TwosomeSessionRedisStore.StoredSession session = new TwosomeSessionRedisStore.StoredSession(
                Map.of("session", "cookie"), "CJENM커머스부문점", "rep-user", LocalDateTime.now());

        store.save("rep:7", session);

        verify(valueOperations).set(eq("twosome:session:rep:7"), any(String.class), eq(Duration.ofHours(24)));
    }

    @Test
    void loadsAdminAndRepresentativeSessions() {
        when(stringRedisTemplate.keys("twosome:session:*")).thenReturn(Set.of(
                "twosome:session:active", "twosome:session:rep:7"));
        TwosomeSessionRedisStore.StoredSession admin = new TwosomeSessionRedisStore.StoredSession(
                Map.of("session", "admin"), "CJENM커머스부문점", "admin", LocalDateTime.now());
        TwosomeSessionRedisStore.StoredSession rep = new TwosomeSessionRedisStore.StoredSession(
                Map.of("session", "rep"), "CJENM커머스부문점", "rep", LocalDateTime.now());
        ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();
        when(valueOperations.get("twosome:session:active")).thenReturn(write(objectMapper, admin));
        when(valueOperations.get("twosome:session:rep:7")).thenReturn(write(objectMapper, rep));

        Map<String, TwosomeSessionRedisStore.StoredSession> sessions = store.loadAll();

        assertThat(sessions).containsOnlyKeys("active", "rep:7");
        assertThat(sessions.get("rep:7").loginId()).isEqualTo("rep");
    }

    private String write(ObjectMapper objectMapper, TwosomeSessionRedisStore.StoredSession session) {
        try {
            return objectMapper.writeValueAsString(session);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
