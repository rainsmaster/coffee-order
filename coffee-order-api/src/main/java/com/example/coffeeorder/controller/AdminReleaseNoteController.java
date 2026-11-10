package com.example.coffeeorder.controller;

import com.example.coffeeorder.dto.ReleaseNoteRequest;
import com.example.coffeeorder.entity.ReleaseNote;
import com.example.coffeeorder.exception.AuthException;
import com.example.coffeeorder.repository.ReleaseNoteRepository;
import com.example.coffeeorder.service.AdminAuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/release-notes")
@RequiredArgsConstructor
public class AdminReleaseNoteController {

    private final AdminAuthService adminAuthService;
    private final ReleaseNoteRepository releaseNoteRepository;

    @GetMapping
    public List<ReleaseNote> list(
            @RequestHeader(value = "X-Admin-Token", required = false) String token) {
        adminAuthService.requireToken(token);
        return releaseNoteRepository.findAllByOrderByPublishedAtDescIdDesc();
    }

    @PostMapping
    public ResponseEntity<ReleaseNote> create(
            @RequestHeader(value = "X-Admin-Token", required = false) String token,
            @RequestBody ReleaseNoteRequest request) {
        adminAuthService.requireToken(token);
        ReleaseNote note = new ReleaseNote();
        apply(note, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(releaseNoteRepository.save(note));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ReleaseNote> update(
            @RequestHeader(value = "X-Admin-Token", required = false) String token,
            @PathVariable Long id,
            @RequestBody ReleaseNoteRequest request) {
        adminAuthService.requireToken(token);
        ReleaseNote note = releaseNoteRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("릴리즈 노트를 찾을 수 없습니다."));
        apply(note, request);
        return ResponseEntity.ok(releaseNoteRepository.save(note));
    }

    @ExceptionHandler(AuthException.class)
    public ResponseEntity<Map<String, Object>> handleAuth(AuthException e) {
        Map<String, Object> body = new HashMap<>();
        body.put("status", "FAILED");
        body.put("error", "ADMIN_AUTH_FAILED");
        body.put("message", e.getMessage());
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(body);
    }

    private void apply(ReleaseNote note, ReleaseNoteRequest request) {
        if (request.getVersion() == null || request.getVersion().isBlank()
                || request.getTitle() == null || request.getTitle().isBlank()
                || request.getSummary() == null || request.getSummary().isBlank()
                || request.getContent() == null || request.getContent().isBlank()) {
            throw new IllegalArgumentException("버전, 제목, 요약, 내용을 모두 입력해주세요.");
        }
        note.setVersion(request.getVersion().trim());
        note.setTitle(request.getTitle().trim());
        note.setSummary(request.getSummary().trim());
        note.setContent(request.getContent().trim());
        boolean publishNow = Boolean.TRUE.equals(request.getPublished());
        if (publishNow && (!Boolean.TRUE.equals(note.getPublished()) || request.getPublishedAt() != null)) {
            note.setPublishedAt(request.getPublishedAt());
        } else if (!publishNow) {
            note.setPublishedAt(request.getPublishedAt());
        }
        note.setPublished(publishNow);
    }
}
