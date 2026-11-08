package com.example.coffeeorder.service;

import com.example.coffeeorder.entity.Member;
import com.example.coffeeorder.entity.Team;
import com.example.coffeeorder.exception.AuthException;
import com.example.coffeeorder.repository.MemberRepository;
import com.example.coffeeorder.repository.TeamRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RepAuthServiceTest {

    @Mock
    private MemberRepository memberRepository;
    @Mock
    private TeamRepository teamRepository;
    @Mock
    private TwosomeCredentialCrypto credentialCrypto;
    @Mock
    private StringRedisTemplate redisTemplate;
    @Mock
    private ValueOperations<String, String> valueOperations;

    private RepAuthService repAuthService;

    @BeforeEach
    void setUp() {
        repAuthService = new RepAuthService(memberRepository, teamRepository, new PinCrypto(),
                credentialCrypto, redisTemplate);
    }

    @Test
    void teamMemberCreatesOwnPinWithoutInvitation() {
        Team team = new Team();
        team.setId(10L);
        team.setName("홍길동");
        team.setDelYn("N");
        when(teamRepository.findById(10L)).thenReturn(Optional.of(team));
        when(memberRepository.findByTeam_IdAndDelYn(10L, "N")).thenReturn(Optional.empty());
        AtomicReference<Member> savedMember = new AtomicReference<>();
        when(memberRepository.save(any(Member.class))).thenAnswer(invocation -> {
            Member member = invocation.getArgument(0);
            if (member.getId() == null) member.setId(42L);
            savedMember.set(member);
            return member;
        });
        when(memberRepository.findByIdAndDelYn(42L, "N"))
                .thenAnswer(invocation -> Optional.of(savedMember.get()));
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);

        RepAuthService.RepLoginResult result = repAuthService.registerRep(10L, "123456");

        assertThat(result.token()).isNotBlank();
        assertThat(result.name()).isEqualTo("홍길동");
        assertThat(savedMember.get().isPinSet()).isTrue();
        assertThat(savedMember.get().getPinHash()).doesNotContain("123456");
        verify(valueOperations).set(anyString(), eq("42"), any(Duration.class));
    }

    @Test
    void existingPinIsNotOverwrittenByRegistrationAttempt() {
        Team team = new Team();
        team.setId(10L);
        team.setName("홍길동");
        Member member = new Member();
        member.setId(42L);
        member.setName("홍길동");
        member.setTeam(team);
        member.setPinSalt("salt");
        PinCrypto pinCrypto = new PinCrypto();
        member.setPinHash(pinCrypto.hash("123456", "salt"));
        when(teamRepository.findById(10L)).thenReturn(Optional.of(team));
        when(memberRepository.findByTeam_IdAndDelYn(10L, "N")).thenReturn(Optional.of(member));
        when(memberRepository.findByIdAndDelYn(42L, "N")).thenReturn(Optional.of(member));

        assertThatThrownBy(() -> repAuthService.registerRep(10L, "654321"))
                .isInstanceOf(AuthException.class)
                .hasMessage("PIN이 올바르지 않습니다.");
        assertThat(member.getPinHash()).isEqualTo(pinCrypto.hash("123456", "salt"));
    }
}
