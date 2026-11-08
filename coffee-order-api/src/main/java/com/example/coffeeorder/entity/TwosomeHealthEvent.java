package com.example.coffeeorder.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 투썸 연동 헬스 이벤트 이력.
 * 로그인/재로그인/keep-alive/메뉴 동기화/장바구니 등 연동 작업의
 * 성공/실패를 관리자 페이지 상태 패널에서 확인하기 위해 기록한다.
 */
@Entity
@Table(name = "twosome_health_event")
@Getter
@Setter
@NoArgsConstructor
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class TwosomeHealthEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "event_type", nullable = false, length = 50)
    private String eventType;

    @Column(name = "success", nullable = false)
    private boolean success;

    @Column(name = "message", length = 2000)
    private String message;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public TwosomeHealthEvent(String eventType, boolean success, String message) {
        this.eventType = eventType;
        this.success = success;
        this.message = message;
    }

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
