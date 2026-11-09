package com.example.coffeeorder.service;

import com.example.coffeeorder.entity.Member;
import com.example.coffeeorder.entity.Team;
import com.example.coffeeorder.exception.AuthException;
import com.example.coffeeorder.repository.MemberRepository;
import com.example.coffeeorder.repository.TeamRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * 팀 대표 인증.
 * - PIN은 숫자 6자리, SHA-256+salt 해시 저장 (관리자도 평문 조회 불가)
 * - 로그인 실패 5회 시 10분 잠금
 * - 로그인 성공 시 rep 토큰(UUID)을 Redis에 12시간 TTL로 저장 (rep:token:{token}=memberId)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RepAuthService {

    private static final Duration TOKEN_TTL = Duration.ofHours(12);
    private static final String TOKEN_KEY_PREFIX = "rep:token:";
    private static final int MAX_PIN_FAILURES = 5;
    private static final Duration LOCK_DURATION = Duration.ofMinutes(10);

    private final MemberRepository memberRepository;
    private final TeamRepository teamRepository;
    private final PinCrypto pinCrypto;
    private final TwosomeCredentialCrypto twosomeCredentialCrypto;
    private final StringRedisTemplate stringRedisTemplate;

    @Transactional
    public RepLoginResult registerRep(Long teamId, String pin) {
        Team team = teamRepository.findById(teamId)
                .filter(t -> "N".equals(t.getDelYn()))
                .orElseThrow(() -> new AuthException("팀원 정보를 찾을 수 없습니다."));
        if (!pinCrypto.isValidPinFormat(pin)) {
            throw new AuthException("PIN은 숫자 6자리여야 합니다.");
        }

        Member member = memberRepository.findByTeam_IdAndDelYn(teamId, "N")
                .orElseGet(() -> {
                    Member created = new Member();
                    created.setName(team.getName());
                    created.setTeam(team);
                    created.setRole("TEAM_REP");
                    return created;
                });

        if (member.isPinSet()) {
            return login(member.getId(), pin);
        }

        member.setPinSalt(pinCrypto.newSalt());
        member.setPinHash(pinCrypto.hash(pin, member.getPinSalt()));
        member.setPinSetAt(LocalDateTime.now());
        member.setPinFailCount(0);
        member.setPinLockedUntil(null);
        memberRepository.save(member);
        log.info("Registered team rep: memberId={}", member.getId());
        return login(member.getId(), pin);
    }

    /**
     * 대표 로그인. 성공 시 토큰 발급.
     * PIN 미설정 상태이면 errorCode=PIN_NOT_SET 예외.
     */
    @Transactional
    public RepLoginResult login(Long memberId, String pin) {
        Member member = requireActiveMember(memberId);

        if (!member.isPinSet()) {
            throw new AuthException("PIN_NOT_SET", "PIN이 설정되지 않았습니다. 본인 팀원을 선택해 PIN을 생성해주세요.");
        }
        verifyPin(member, pin);

        member.setPinFailCount(0);
        member.setPinLockedUntil(null);
        member.setLastLoginAt(LocalDateTime.now());
        memberRepository.save(member);

        String token = UUID.randomUUID().toString();
        stringRedisTemplate.opsForValue()
                .set(TOKEN_KEY_PREFIX + token, String.valueOf(member.getId()), TOKEN_TTL);
        log.info("Rep logged in: memberId={}", memberId);

        return new RepLoginResult(token, member.getName(),
                member.getTeam().getName(), member.getTeam().getId());
    }

    /**
     * PIN 변경 (현재 PIN 확인). 성공 시 실패 카운트 초기화.
     */
    @Transactional
    public void changePin(String token, String currentPin, String newPin) {
        Member member = resolveByToken(token);
        if (!pinCrypto.isValidPinFormat(newPin)) {
            throw new AuthException("새 PIN은 숫자 6자리여야 합니다.");
        }
        verifyPin(member, currentPin);

        member.setPinSalt(pinCrypto.newSalt());
        member.setPinHash(pinCrypto.hash(newPin, member.getPinSalt()));
        member.setPinSetAt(LocalDateTime.now());
        member.setPinFailCount(0);
        member.setPinLockedUntil(null);
        memberRepository.save(member);
        log.info("PIN changed for memberId={}", member.getId());
    }

    /**
     * rep 토큰으로 활성 멤버 조회 (GET /api/rep/me 등)
     */
    public Member resolveByToken(String token) {
        if (token == null || token.isBlank()) {
            throw new AuthException("대표 로그인이 필요합니다.");
        }
        String memberId = stringRedisTemplate.opsForValue().get(TOKEN_KEY_PREFIX + token);
        if (memberId == null) {
            throw new AuthException("대표 로그인이 만료되었습니다. 다시 로그인해주세요.");
        }
        return requireActiveMember(Long.valueOf(memberId));
    }

    /**
     * rep 토큰으로 멤버 ID 조회. 토큰 없음/만료/멤버 없음 시 empty (예외 없음).
     */
    public java.util.Optional<Long> resolveMemberIdIfValid(String token) {
        if (token == null || token.isBlank()) {
            return java.util.Optional.empty();
        }
        String memberId = stringRedisTemplate.opsForValue().get(TOKEN_KEY_PREFIX + token);
        if (memberId == null) {
            return java.util.Optional.empty();
        }
        return java.util.Optional.of(Long.valueOf(memberId));
    }

    /**
     * 투썸 계정 등록 (AES-256-GCM 암호화 저장). 평문은 즉시 폐기.
     */
    @Transactional
    public void registerTwosomeAccount(String token, String twosomeId, String twosomePw) {
        Member member = resolveByToken(token);
        if (twosomeId == null || twosomeId.isBlank() || twosomePw == null || twosomePw.isBlank()) {
            throw new AuthException("투썸 아이디와 비밀번호를 입력해주세요.");
        }
        member.setTwosomeId(twosomeId.trim());
        member.setTwosomePw(twosomeCredentialCrypto.encrypt(twosomePw));
        memberRepository.save(member);
        log.info("Registered twosome account for memberId={}", member.getId());
    }

    /**
     * 복호화된 투썸 자격증명 조회 (담기 실행 시에만 메모리에 존재)
     */
    public TwosomeCredentials requireTwosomeCredentials(String token) {
        Member member = resolveByToken(token);
        if (member.getTwosomeId() == null || member.getTwosomePw() == null) {
            throw new AuthException("NO_TWOSOME_ACCOUNT", "등록된 투썸 계정이 없습니다. 먼저 투썸 계정을 등록해주세요.");
        }
        return new TwosomeCredentials(member.getId(), member.getTwosomeId(),
                twosomeCredentialCrypto.decrypt(member.getTwosomePw()));
    }

    @Transactional(readOnly = true)
    public TwosomeCredentials requireTwosomeCredentialsForAutoLogin(Long memberId) {
        Member member = requireActiveMember(memberId);
        if (member.getTwosomeId() == null || member.getTwosomePw() == null) {
            throw new AuthException("NO_TWOSOME_ACCOUNT", "등록된 투썸 계정이 없습니다. 먼저 투썸 계정을 등록해주세요.");
        }
        return new TwosomeCredentials(member.getId(), member.getTwosomeId(),
                twosomeCredentialCrypto.decrypt(member.getTwosomePw()));
    }

    public record TwosomeCredentials(Long memberId, String twosomeId, String twosomePw) {
    }

    /**
     * PIN 검증 공통 처리: 잠금 확인 → 일치 여부 → 실패 카운트/잠금 처리
     */
    private void verifyPin(Member member, String pin) {
        if (member.isPinLocked()) {
            throw new AuthException("PIN 입력 실패가 많아 잠시 후 다시 시도해주세요.");
        }
        if (pinCrypto.matches(pin, member.getPinSalt(), member.getPinHash())) {
            return;
        }
        member.setPinFailCount(member.getPinFailCount() + 1);
        if (member.getPinFailCount() >= MAX_PIN_FAILURES) {
            member.setPinLockedUntil(LocalDateTime.now().plus(LOCK_DURATION));
            member.setPinFailCount(0);
            memberRepository.save(member);
            throw new AuthException("PIN 입력 실패가 많아 10분간 잠금 처리되었습니다.");
        }
        memberRepository.save(member);
        throw new AuthException("PIN이 올바르지 않습니다.");
    }

    public Member requireActiveMember(Long memberId) {
        if (memberId == null) {
            throw new AuthException("대표 정보를 찾을 수 없습니다.");
        }
        return memberRepository.findByIdAndDelYn(memberId, "N")
                .orElseThrow(() -> new AuthException("대표 정보를 찾을 수 없습니다."));
    }

    public record RepLoginResult(String token, String name, String teamName, Long teamId) {
    }
}
