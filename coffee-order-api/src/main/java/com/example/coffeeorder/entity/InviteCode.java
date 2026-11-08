package com.example.coffeeorder.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;

/**
 * 팀 대표 초대코드. 평문 코드는 발급 직후 폐기하고 해시만 저장한다.
 * 1회 사용, 유효기간 7일. 재발급/대표 삭제 시 기존 미사용 코드는 무효화(del_yn)한다.
 */
@Entity
@Table(name = "invite_code")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class InviteCode {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Member member;

    @Column(name = "code_hash", nullable = false, length = 100)
    private String codeHash;

    @Column(name = "issued_at", nullable = false)
    private LocalDateTime issuedAt;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "used_at")
    private LocalDateTime usedAt;

    @Column(name = "del_yn", nullable = false, length = 1)
    private String delYn = "N";

    @Column(name = "created_date", nullable = false, updatable = false)
    private LocalDateTime createdDate;

    public InviteCode(Member member, String codeHash, LocalDateTime issuedAt, LocalDateTime expiresAt) {
        this.member = member;
        this.codeHash = codeHash;
        this.issuedAt = issuedAt;
        this.expiresAt = expiresAt;
    }

    @PrePersist
    protected void onCreate() {
        createdDate = LocalDateTime.now();
        if (delYn == null) {
            delYn = "N";
        }
    }

    /** 미사용 유효 코드 여부 */
    public boolean isActive() {
        return "N".equals(delYn) && usedAt == null;
    }
}
