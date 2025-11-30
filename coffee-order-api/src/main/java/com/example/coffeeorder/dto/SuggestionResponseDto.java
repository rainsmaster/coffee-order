package com.example.coffeeorder.dto;

import com.example.coffeeorder.entity.Suggestion;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.web.util.HtmlUtils;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SuggestionResponseDto {
    private Long id;
    private String title;
    private String content;
    private String author;
    private Boolean pinned;
    private Boolean deleted;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private int commentCount;

    public static SuggestionResponseDto from(Suggestion suggestion, int commentCount) {
        SuggestionResponseDto dto = new SuggestionResponseDto();
        dto.setId(suggestion.getId());
        dto.setDeleted("Y".equals(suggestion.getDelYn()));

        if (dto.getDeleted()) {
            dto.setTitle("삭제된 글입니다");
            dto.setContent("");
            dto.setAuthor("");
        } else {
            dto.setTitle(sanitize(suggestion.getTitle()));
            dto.setContent(sanitize(suggestion.getContent()));
            dto.setAuthor(sanitize(suggestion.getAuthor()));
        }

        dto.setPinned(suggestion.getPinned());
        dto.setCreatedAt(suggestion.getCreatedAt());
        dto.setUpdatedAt(suggestion.getUpdatedAt());
        dto.setCommentCount(commentCount);
        return dto;
    }

    private static String sanitize(String value) {
        return value != null ? HtmlUtils.htmlEscape(value) : null;
    }
}
