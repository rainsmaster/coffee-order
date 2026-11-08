package com.example.coffeeorder.service;

import com.example.coffeeorder.entity.InviteCode;
import com.example.coffeeorder.entity.Member;
import com.example.coffeeorder.exception.AuthException;
import com.example.coffeeorder.repository.InviteCodeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 팀 대표 초대코드 발급/검증.
 * - 8자리 영대문자+숫자 (혼동문자 0/O 1/I 제외)
 * - 유효 7일, 1회 사용
 * - 재발급/대표 삭제 시 기존 미사용 코드는 del_yn='Y'로 무효화
 * - 평문은 발급 응답 직후 폐기, 저장은 해시만
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class InviteCodeService {

    private static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int CODE_LENGTH = 8;
    private static final Duration CODE_TTL = Duration.ofDays(7);

    private final InviteCodeRepository inviteCodeRepository;
    private final PinCrypto pinCrypto;
    private final SecureRandom secureRandom = new SecureRandom();

    /**
     * 초대코드 발급. 기존 미사용 코드는 무효화한다.
     *
     * @return 평문 코드 (응답 1회만 반환)
     */
    @Transactional
    public String issue(Member member) {
        invalidateActiveCodes(member);

        String code = generateCode();
        LocalDateTime now = LocalDateTime.now();
        inviteCodeRepository.save(new InviteCode(
                member, pinCrypto.hash(code, memberSalt(member)), now, now.plus(CODE_TTL)));
        log.info("Issued invite code for memberId={}", member.getId());
        return code;
    }

    /**
     * 초대코드 검증 후 사용 처리(1회용).
     * 소유자 일치/미사용/유효기간을 확인한다.
     */
    @Transactional
    public void verifyAndConsume(Member member, String code) {
        if (code == null || code.isBlank()) {
            throw new AuthException("초대코드를 입력해주세요.");
        }
        List<InviteCode> candidates = inviteCodeRepository.findByMember(member);
        String salt = memberSalt(member);
        for (InviteCode inviteCode : candidates) {
            if (inviteCode.isActive()
                    && inviteCode.getExpiresAt().isAfter(LocalDateTime.now())
                    && pinCrypto.matches(code, salt, inviteCode.getCodeHash())) {
                inviteCode.setUsedAt(LocalDateTime.now());
                inviteCodeRepository.save(inviteCode);
                return;
            }
        }
        throw new AuthException("초대코드가 올바르지 않거나 만료되었습니다.");
    }

    /**
     * 멤버의 미사용 초대코드 무효화 (재발급/삭제 시)
     */
    @Transactional
    public void invalidateActiveCodes(Member member) {
        for (InviteCode inviteCode : inviteCodeRepository.findByMember(member)) {
            if (inviteCode.isActive()) {
                inviteCode.setDelYn("Y");
                inviteCodeRepository.save(inviteCode);
            }
        }
    }

    private String generateCode() {
        StringBuilder sb = new StringBuilder(CODE_LENGTH);
        for (int i = 0; i < CODE_LENGTH; i++) {
            sb.append(CODE_ALPHABET.charAt(secureRandom.nextInt(CODE_ALPHABET.length())));
        }
        return sb.toString();
    }

    /** 코드 해시 salt: 멤버 고유값(발급 시점 이전에 존재하는 값) 사용 */
    private String memberSalt(Member member) {
        return "invite:" + member.getId();
    }
}
