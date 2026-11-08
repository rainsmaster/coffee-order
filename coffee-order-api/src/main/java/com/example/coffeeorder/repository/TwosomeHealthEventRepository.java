package com.example.coffeeorder.repository;

import com.example.coffeeorder.entity.TwosomeHealthEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface TwosomeHealthEventRepository extends JpaRepository<TwosomeHealthEvent, Long> {

    // 유형별 마지막 성공/실패
    Optional<TwosomeHealthEvent> findTopByEventTypeAndSuccessTrueOrderByCreatedAtDesc(String eventType);

    Optional<TwosomeHealthEvent> findTopByEventTypeAndSuccessFalseOrderByCreatedAtDesc(String eventType);

    // 유형별 최근 24시간 내 실패 존재 여부
    boolean existsByEventTypeAndSuccessFalseAndCreatedAtAfter(String eventType, LocalDateTime after);

    // 최근 이벤트 N건 (시각 역순)
    List<TwosomeHealthEvent> findTop20ByOrderByCreatedAtDesc();

    // 보관 기한 지난 이벤트 일괄 삭제 (purge 스케줄러용)
    long deleteByCreatedAtBefore(LocalDateTime cutoff);
}
