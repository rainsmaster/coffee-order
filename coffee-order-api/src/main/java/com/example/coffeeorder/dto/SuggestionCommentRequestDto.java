package com.example.coffeeorder.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SuggestionCommentRequestDto {
    private String content;
    private String author;
    private String password;
}
