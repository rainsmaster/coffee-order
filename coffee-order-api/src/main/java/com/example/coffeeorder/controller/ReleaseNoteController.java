package com.example.coffeeorder.controller;

import com.example.coffeeorder.entity.ReleaseNote;
import com.example.coffeeorder.repository.ReleaseNoteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/release-notes")
@RequiredArgsConstructor
public class ReleaseNoteController {

    private final ReleaseNoteRepository releaseNoteRepository;

    @GetMapping
    public java.util.List<ReleaseNote> listPublished() {
        return releaseNoteRepository.findByPublishedTrueOrderByPublishedAtDescIdDesc();
    }

    @GetMapping("/latest")
    public ResponseEntity<ReleaseNote> latest() {
        return releaseNoteRepository.findTopByPublishedTrueOrderByPublishedAtDescIdDesc()
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ReleaseNote> getById(@PathVariable Long id) {
        return releaseNoteRepository.findById(id)
                .filter(note -> Boolean.TRUE.equals(note.getPublished()))
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
