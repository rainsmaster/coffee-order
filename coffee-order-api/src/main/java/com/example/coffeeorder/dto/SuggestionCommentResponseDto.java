package com.example.coffeeorder.dto;

import com.example.coffeeorder.entity.SuggestionComment;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.web.util.HtmlUtils;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SuggestionCommentResponseDto {
    private Long id;
    private Long suggestionId;
    private String content;
    private String author;
    private Boolean deleted;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static SuggestionCommentResponseDto from(SuggestionComment comment) {
        SuggestionCommentResponseDto dto = new SuggestionCommentResponseDto();
        dto.setId(comment.getId());
        dto.setSuggestionId(comment.getSuggestion().getId());
        dto.setDeleted("Y".equals(comment.getDelYn()));

        if (dto.getDeleted()) {
            dto.setContent("삭제된 댓글입니다");
            dto.setAuthor("");
        } else {
            dto.setContent(sanitize(comment.getContent()));
            dto.setAuthor(sanitize(comment.getAuthor()));
        }

        dto.setCreatedAt(comment.getCreatedAt());
        dto.setUpdatedAt(comment.getUpdatedAt());
        return dto;
    }

    private static String sanitize(String value) {
        return value != null ? HtmlUtils.htmlEscape(value) : null;
    }
}
