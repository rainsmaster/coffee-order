package com.example.coffeeorder.repository;

import com.example.coffeeorder.entity.Suggestion;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SuggestionRepository extends JpaRepository<Suggestion, Long> {

    // 고정글 조회 (최신순, 최대 3개)
    List<Suggestion> findByPinnedTrueAndDelYnOrderByCreatedAtDesc(String delYn);

    // 일반글 페이지네이션 (고정글 제외, 최신순)
    Page<Suggestion> findByPinnedFalseAndDelYnOrderByCreatedAtDesc(String delYn, Pageable pageable);

    // 전체 글 수 (삭제되지 않은 글, 고정글 제외)
    long countByPinnedFalseAndDelYn(String delYn);

    // 현재 고정된 글 수
    long countByPinnedTrueAndDelYn(String delYn);

    // ID로 조회 (삭제 여부 무관)
    Optional<Suggestion> findById(Long id);
}
