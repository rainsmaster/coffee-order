package com.example.coffeeorder.repository;

import com.example.coffeeorder.entity.SuggestionComment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SuggestionCommentRepository extends JpaRepository<SuggestionComment, Long> {

    // 특정 글의 댓글 조회 (삭제되지 않은 것만, 작성순)
    List<SuggestionComment> findBySuggestionIdAndDelYnOrderByCreatedAtAsc(Long suggestionId, String delYn);

    // 특정 글의 모든 댓글 조회 (삭제 포함, 작성순) - 삭제된 댓글 표시용
    List<SuggestionComment> findBySuggestionIdOrderByCreatedAtAsc(Long suggestionId);

    // 특정 글의 댓글 수
    long countBySuggestionIdAndDelYn(Long suggestionId, String delYn);
}
