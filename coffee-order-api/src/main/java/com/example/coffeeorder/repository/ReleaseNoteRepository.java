package com.example.coffeeorder.repository;

import com.example.coffeeorder.entity.ReleaseNote;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ReleaseNoteRepository extends JpaRepository<ReleaseNote, Long> {
    Optional<ReleaseNote> findTopByPublishedTrueOrderByPublishedAtDescIdDesc();
    List<ReleaseNote> findAllByOrderByPublishedAtDescIdDesc();
}
