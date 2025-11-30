package com.example.coffeeorder.controller;

import com.example.coffeeorder.dto.*;
import com.example.coffeeorder.service.SuggestionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/suggestions")
@RequiredArgsConstructor
public class SuggestionController {

    private final SuggestionService suggestionService;

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgumentException(IllegalArgumentException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("error", e.getMessage()));
    }

    // ==================== 건의사항 ====================

    @GetMapping
    public ResponseEntity<SuggestionListResponseDto> getSuggestions(
            @RequestParam(defaultValue = "0") int page) {
        return ResponseEntity.ok(suggestionService.getSuggestions(page));
    }

    @GetMapping("/{id}")
    public ResponseEntity<SuggestionResponseDto> getSuggestion(@PathVariable Long id) {
        return ResponseEntity.ok(suggestionService.getSuggestion(id));
    }

    @PostMapping
    public ResponseEntity<SuggestionResponseDto> createSuggestion(
            @RequestBody SuggestionRequestDto request) {
        return ResponseEntity.ok(suggestionService.createSuggestion(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<SuggestionResponseDto> updateSuggestion(
            @PathVariable Long id,
            @RequestBody SuggestionRequestDto request) {
        return ResponseEntity.ok(suggestionService.updateSuggestion(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteSuggestion(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        String password = body.get("password");
        suggestionService.deleteSuggestion(id, password);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/pin")
    public ResponseEntity<SuggestionResponseDto> togglePin(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        String adminPassword = body.get("adminPassword");
        return ResponseEntity.ok(suggestionService.togglePin(id, adminPassword));
    }

    // ==================== 댓글 ====================

    @GetMapping("/{suggestionId}/comments")
    public ResponseEntity<List<SuggestionCommentResponseDto>> getComments(
            @PathVariable Long suggestionId) {
        return ResponseEntity.ok(suggestionService.getComments(suggestionId));
    }

    @PostMapping("/{suggestionId}/comments")
    public ResponseEntity<SuggestionCommentResponseDto> createComment(
            @PathVariable Long suggestionId,
            @RequestBody SuggestionCommentRequestDto request) {
        return ResponseEntity.ok(suggestionService.createComment(suggestionId, request));
    }

    @PutMapping("/comments/{commentId}")
    public ResponseEntity<SuggestionCommentResponseDto> updateComment(
            @PathVariable Long commentId,
            @RequestBody SuggestionCommentRequestDto request) {
        return ResponseEntity.ok(suggestionService.updateComment(commentId, request));
    }

    @DeleteMapping("/comments/{commentId}")
    public ResponseEntity<Void> deleteComment(
            @PathVariable Long commentId,
            @RequestBody Map<String, String> body) {
        String password = body.get("password");
        suggestionService.deleteComment(commentId, password);
        return ResponseEntity.ok().build();
    }
}
