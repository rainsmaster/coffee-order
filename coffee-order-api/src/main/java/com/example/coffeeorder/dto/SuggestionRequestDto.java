package com.example.coffeeorder.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SuggestionRequestDto {
    private String title;
    private String content;
    private String author;
    private String password;
}
