package com.example.coffeeorder.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SuggestionListResponseDto {
    private List<SuggestionResponseDto> pinnedSuggestions;
    private List<SuggestionResponseDto> suggestions;
    private int currentPage;
    private int totalPages;
    private long totalElements;
}
