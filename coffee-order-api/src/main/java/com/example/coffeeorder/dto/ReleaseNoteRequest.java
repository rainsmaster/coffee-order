package com.example.coffeeorder.dto;

import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
public class ReleaseNoteRequest {
    private String version;
    private String title;
    private String summary;
    private String content;
    private LocalDateTime publishedAt;
    private Boolean published;
}
