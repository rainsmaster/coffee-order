package com.example.coffeeorder.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "suggestion_comment")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SuggestionComment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "suggestion_id", nullable = false)
    private Suggestion suggestion;

    @Column(nullable = false, length = 500)
    private String content;

    @Column(nullable = false, length = 50)
    private String author;

    @Column(nullable = false)
    private String password;

    @Column(nullable = false, length = 1)
    private String delYn = "N";

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
