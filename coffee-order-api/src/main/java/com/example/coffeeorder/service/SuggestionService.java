package com.example.coffeeorder.service;

import com.example.coffeeorder.dto.*;
import com.example.coffeeorder.entity.Suggestion;
import com.example.coffeeorder.entity.SuggestionComment;
import com.example.coffeeorder.repository.SuggestionCommentRepository;
import com.example.coffeeorder.repository.SuggestionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SuggestionService {

    private final SuggestionRepository suggestionRepository;
    private final SuggestionCommentRepository commentRepository;

    @Value("${app.admin.password:admin1234}")
    private String adminPassword;

    private static final int PAGE_SIZE = 20;
    private static final int MAX_PINNED = 3;
    private static final String MSG_SUGGESTION_NOT_FOUND = "존재하지 않는 건의사항입니다.";

    // ==================== 건의사항 ====================

    public SuggestionListResponseDto getSuggestions(int page) {
        // 고정글 조회 (삭제되지 않은 것만)
        List<Suggestion> pinnedSuggestions = suggestionRepository
                .findByPinnedTrueAndDelYnOrderByCreatedAtDesc("N");

        // 일반글 페이징 조회
        Pageable pageable = PageRequest.of(page, PAGE_SIZE);
        Page<Suggestion> suggestionPage = suggestionRepository
                .findByPinnedFalseAndDelYnOrderByCreatedAtDesc("N", pageable);

        // DTO 변환
        List<SuggestionResponseDto> pinnedDtos = pinnedSuggestions.stream()
                .map(s -> SuggestionResponseDto.from(s, getCommentCount(s.getId())))
                .collect(Collectors.toList());

        List<SuggestionResponseDto> suggestionDtos = suggestionPage.getContent().stream()
                .map(s -> SuggestionResponseDto.from(s, getCommentCount(s.getId())))
                .collect(Collectors.toList());

        return new SuggestionListResponseDto(
                pinnedDtos,
                suggestionDtos,
                page,
                suggestionPage.getTotalPages(),
                suggestionPage.getTotalElements()
        );
    }

    public SuggestionResponseDto getSuggestion(Long id) {
        Suggestion suggestion = suggestionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException(MSG_SUGGESTION_NOT_FOUND));

        return SuggestionResponseDto.from(suggestion, getCommentCount(id));
    }

    @Transactional
    public SuggestionResponseDto createSuggestion(SuggestionRequestDto request) {
        validateSuggestionRequest(request);

        Suggestion suggestion = new Suggestion();
        suggestion.setTitle(request.getTitle());
        suggestion.setContent(request.getContent());
        suggestion.setAuthor(request.getAuthor());
        suggestion.setPassword(hashPassword(request.getPassword()));
        suggestion.setPinned(false);

        Suggestion saved = suggestionRepository.save(suggestion);
        return SuggestionResponseDto.from(saved, 0);
    }

    @Transactional
    public SuggestionResponseDto updateSuggestion(Long id, SuggestionRequestDto request) {
        Suggestion suggestion = suggestionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException(MSG_SUGGESTION_NOT_FOUND));

        if ("Y".equals(suggestion.getDelYn())) {
            throw new IllegalArgumentException("삭제된 건의사항입니다.");
        }

        if (!verifyPassword(request.getPassword(), suggestion.getPassword())) {
            throw new IllegalArgumentException("비밀번호가 일치하지 않습니다.");
        }

        suggestion.setTitle(request.getTitle());
        suggestion.setContent(request.getContent());
        suggestion.setAuthor(request.getAuthor());

        return SuggestionResponseDto.from(suggestion, getCommentCount(id));
    }

    @Transactional
    public void deleteSuggestion(Long id, String password) {
        Suggestion suggestion = suggestionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException(MSG_SUGGESTION_NOT_FOUND));

        if ("Y".equals(suggestion.getDelYn())) {
            throw new IllegalArgumentException("이미 삭제된 건의사항입니다.");
        }

        // 관리자 비밀번호 또는 작성자 비밀번호 확인
        boolean isAdmin = adminPassword.equals(password);
        boolean isAuthor = verifyPassword(password, suggestion.getPassword());

        if (!isAdmin && !isAuthor) {
            throw new IllegalArgumentException("비밀번호가 일치하지 않습니다.");
        }

        // Soft delete - 건의사항과 댓글 모두
        suggestion.setDelYn("Y");
        for (SuggestionComment comment : suggestion.getComments()) {
            comment.setDelYn("Y");
        }
    }

    @Transactional
    public SuggestionResponseDto togglePin(Long id, String adminPwd) {
        if (!adminPassword.equals(adminPwd)) {
            throw new IllegalArgumentException("관리자 비밀번호가 일치하지 않습니다.");
        }

        Suggestion suggestion = suggestionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException(MSG_SUGGESTION_NOT_FOUND));

        if ("Y".equals(suggestion.getDelYn())) {
            throw new IllegalArgumentException("삭제된 건의사항은 고정할 수 없습니다.");
        }

        // 고정 해제하는 경우
        if (suggestion.getPinned()) {
            suggestion.setPinned(false);
        } else {
            // 고정하는 경우 - 최대 3개 확인
            long pinnedCount = suggestionRepository.countByPinnedTrueAndDelYn("N");
            if (pinnedCount >= MAX_PINNED) {
                throw new IllegalArgumentException("고정글은 최대 " + MAX_PINNED + "개까지만 가능합니다.");
            }
            suggestion.setPinned(true);
        }

        return SuggestionResponseDto.from(suggestion, getCommentCount(id));
    }

    // ==================== 댓글 ====================

    public List<SuggestionCommentResponseDto> getComments(Long suggestionId) {
        // 삭제된 댓글도 포함하여 조회 (삭제된 댓글입니다 표시를 위해)
        List<SuggestionComment> comments = commentRepository
                .findBySuggestionIdOrderByCreatedAtAsc(suggestionId);

        return comments.stream()
                .map(SuggestionCommentResponseDto::from)
                .collect(Collectors.toList());
    }

    @Transactional
    public SuggestionCommentResponseDto createComment(Long suggestionId, SuggestionCommentRequestDto request) {
        Suggestion suggestion = suggestionRepository.findById(suggestionId)
                .orElseThrow(() -> new IllegalArgumentException(MSG_SUGGESTION_NOT_FOUND));

        if ("Y".equals(suggestion.getDelYn())) {
            throw new IllegalArgumentException("삭제된 건의사항에는 댓글을 작성할 수 없습니다.");
        }

        validateCommentRequest(request);

        SuggestionComment comment = new SuggestionComment();
        comment.setSuggestion(suggestion);
        comment.setContent(request.getContent());
        comment.setAuthor(request.getAuthor());
        comment.setPassword(hashPassword(request.getPassword()));

        SuggestionComment saved = commentRepository.save(comment);
        return SuggestionCommentResponseDto.from(saved);
    }

    @Transactional
    public SuggestionCommentResponseDto updateComment(Long commentId, SuggestionCommentRequestDto request) {
        SuggestionComment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 댓글입니다."));

        if ("Y".equals(comment.getDelYn())) {
            throw new IllegalArgumentException("삭제된 댓글입니다.");
        }

        if (!verifyPassword(request.getPassword(), comment.getPassword())) {
            throw new IllegalArgumentException("비밀번호가 일치하지 않습니다.");
        }

        comment.setContent(request.getContent());

        return SuggestionCommentResponseDto.from(comment);
    }

    @Transactional
    public void deleteComment(Long commentId, String password) {
        SuggestionComment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 댓글입니다."));

        if ("Y".equals(comment.getDelYn())) {
            throw new IllegalArgumentException("이미 삭제된 댓글입니다.");
        }

        // 관리자 비밀번호 또는 작성자 비밀번호 확인
        boolean isAdmin = adminPassword.equals(password);
        boolean isAuthor = verifyPassword(password, comment.getPassword());

        if (!isAdmin && !isAuthor) {
            throw new IllegalArgumentException("비밀번호가 일치하지 않습니다.");
        }

        comment.setDelYn("Y");
    }

    // ==================== Helper Methods ====================

    private int getCommentCount(Long suggestionId) {
        return (int) commentRepository.countBySuggestionIdAndDelYn(suggestionId, "N");
    }

    /**
     * SHA-256 해싱
     */
    private String hashPassword(String password) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(password.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 알고리즘을 사용할 수 없습니다.", e);
        }
    }

    /**
     * 비밀번호 검증
     */
    private boolean verifyPassword(String rawPassword, String hashedPassword) {
        return hashPassword(rawPassword).equals(hashedPassword);
    }

    private void validateSuggestionRequest(SuggestionRequestDto request) {
        if (request.getTitle() == null || request.getTitle().trim().isEmpty()) {
            throw new IllegalArgumentException("제목을 입력해주세요.");
        }
        if (request.getTitle().length() > 100) {
            throw new IllegalArgumentException("제목은 100자 이내로 입력해주세요.");
        }
        if (request.getContent() == null || request.getContent().trim().isEmpty()) {
            throw new IllegalArgumentException("내용을 입력해주세요.");
        }
        if (request.getContent().length() > 1000) {
            throw new IllegalArgumentException("내용은 1000자 이내로 입력해주세요.");
        }
        if (request.getAuthor() == null || request.getAuthor().trim().isEmpty()) {
            throw new IllegalArgumentException("이름을 입력해주세요.");
        }
        if (request.getAuthor().length() > 50) {
            throw new IllegalArgumentException("이름은 50자 이내로 입력해주세요.");
        }
        if (request.getPassword() == null || request.getPassword().length() < 4) {
            throw new IllegalArgumentException("비밀번호는 4자 이상 입력해주세요.");
        }
    }

    private void validateCommentRequest(SuggestionCommentRequestDto request) {
        if (request.getContent() == null || request.getContent().trim().isEmpty()) {
            throw new IllegalArgumentException("댓글 내용을 입력해주세요.");
        }
        if (request.getContent().length() > 500) {
            throw new IllegalArgumentException("댓글은 500자 이내로 입력해주세요.");
        }
        if (request.getAuthor() == null || request.getAuthor().trim().isEmpty()) {
            throw new IllegalArgumentException("이름을 입력해주세요.");
        }
        if (request.getAuthor().length() > 50) {
            throw new IllegalArgumentException("이름은 50자 이내로 입력해주세요.");
        }
        if (request.getPassword() == null || request.getPassword().length() < 4) {
            throw new IllegalArgumentException("비밀번호는 4자 이상 입력해주세요.");
        }
    }
}
