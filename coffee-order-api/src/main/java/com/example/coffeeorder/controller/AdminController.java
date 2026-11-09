package com.example.coffeeorder.controller;

import com.example.coffeeorder.dto.AdminLoginRequest;
import com.example.coffeeorder.dto.RepAdminItem;
import com.example.coffeeorder.dto.RepCreateRequest;
import com.example.coffeeorder.entity.Member;
import com.example.coffeeorder.entity.Team;
import com.example.coffeeorder.exception.AuthException;
import com.example.coffeeorder.repository.MemberRepository;
import com.example.coffeeorder.repository.TeamRepository;
import com.example.coffeeorder.service.AdminAuthService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 관리자 로그인과 공개 대표 관리 API.
 * 대표 관리는 누구나 사용할 수 있으며 PIN 관련 값은 어떤 응답에도 포함하지 않는다.
 */
@Slf4j
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:3000")
public class AdminController {

    private final AdminAuthService adminAuthService;
    private final MemberRepository memberRepository;
    private final TeamRepository teamRepository;

    // 관리자 로그인 (토큰 불필요)
    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody AdminLoginRequest request) {
        String token = adminAuthService.login(request.getPassword());
        Map<String, Object> result = new HashMap<>();
        result.put("status", "SUCCESS");
        result.put("token", token);
        return ResponseEntity.ok(result);
    }

    // 팀 대표 목록
    @GetMapping("/reps")
    @Transactional(readOnly = true)
    public ResponseEntity<List<RepAdminItem>> getReps(
            @RequestHeader(value = "X-Admin-Token", required = false) String token) {
        // 대표 관리는 로그인 없이 사용할 수 있는 공개 영역이다.
        List<RepAdminItem> reps = memberRepository.findByDelYnOrderByIdAsc("N").stream()
                .map(this::toAdminItem)
                .toList();
        return ResponseEntity.ok(reps);
    }

    // 팀 대표 등록 (1팀 N대표 허용)
    @PostMapping("/reps")
    public ResponseEntity<RepAdminItem> createRep(
            @RequestHeader(value = "X-Admin-Token", required = false) String token,
            @RequestBody RepCreateRequest request) {
        // 대표 관리는 로그인 없이 사용할 수 있는 공개 영역이다.
        Member member = new Member();
        member.setName(requireName(request.getName()));
        member.setTeam(requireTeam(request.getTeamId()));
        member.setRole("TEAM_REP");
        return ResponseEntity.status(HttpStatus.CREATED).body(toAdminItem(memberRepository.save(member)));
    }

    // 팀 대표 수정
    @PutMapping("/reps/{id}")
    public ResponseEntity<RepAdminItem> updateRep(
            @RequestHeader(value = "X-Admin-Token", required = false) String token,
            @PathVariable Long id,
            @RequestBody RepCreateRequest request) {
        // 대표 관리는 로그인 없이 사용할 수 있는 공개 영역이다.
        Member member = requireMember(id);
        member.setName(requireName(request.getName()));
        member.setTeam(requireTeam(request.getTeamId()));
        return ResponseEntity.ok(toAdminItem(memberRepository.save(member)));
    }

    // 팀 대표 삭제 (소프트 삭제)
    @DeleteMapping("/reps/{id}")
    @Transactional
    public ResponseEntity<Map<String, Object>> deleteRep(
            @RequestHeader(value = "X-Admin-Token", required = false) String token,
            @PathVariable Long id) {
        // 대표 관리는 로그인 없이 사용할 수 있는 공개 영역이다.
        Member member = requireMember(id);
        member.setDelYn("Y");
        memberRepository.save(member);
        log.info("Deleted rep memberId={}", id);

        Map<String, Object> result = new HashMap<>();
        result.put("status", "SUCCESS");
        result.put("message", "팀 대표가 삭제되었습니다.");
        return ResponseEntity.ok(result);
    }

    // ==================== 헬퍼 ====================

    private RepAdminItem toAdminItem(Member member) {
        return new RepAdminItem(
                member.getId(),
                member.getName(),
                member.getTeam().getDepartment().getId(),
                member.getTeam().getDepartment().getName(),
                member.getTeam().getId(),
                member.getTeam().getName(),
                member.isPinSet(),
                member.getLastLoginAt(),
                member.getCreatedDate());
    }

    private Member requireMember(Long id) {
        return memberRepository.findByIdAndDelYn(id, "N")
                .orElseThrow(() -> new IllegalArgumentException("팀 대표를 찾을 수 없습니다."));
    }

    private Team requireTeam(Long teamId) {
        if (teamId == null) {
            throw new IllegalArgumentException("팀을 선택해주세요.");
        }
        return teamRepository.findById(teamId)
                .filter(team -> "N".equals(team.getDelYn()))
                .orElseThrow(() -> new IllegalArgumentException("팀을 찾을 수 없습니다."));
    }

    private String requireName(String name) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("이름을 입력해주세요.");
        }
        return name.trim();
    }

    // 인증 실패 (401)
    @ExceptionHandler(AuthException.class)
    public ResponseEntity<Map<String, Object>> handleAuth(AuthException e) {
        Map<String, Object> body = new HashMap<>();
        body.put("status", "FAILED");
        body.put("error", e.getErrorCode() != null ? e.getErrorCode() : "AUTH_FAILED");
        body.put("message", e.getMessage());
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(body);
    }

    // 잘못된 요청 (400)
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleBadRequest(IllegalArgumentException e) {
        Map<String, Object> body = new HashMap<>();
        body.put("status", "FAILED");
        body.put("error", "BAD_REQUEST");
        body.put("message", e.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }
}
