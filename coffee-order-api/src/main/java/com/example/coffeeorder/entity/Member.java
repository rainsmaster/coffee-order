package com.example.coffeeorder.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;

/**
 * 팀 대표. PIN은 해시+salt 저장으로 본인만 알 수 있다.
 * 투썸 아이디와 암호화된 자격증명은 대표별 장바구니 연동에 사용한다.
 */
@Entity
@Table(name = "member")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Member {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "team_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Team team;

    @Column(length = 20)
    private String role = "TEAM_REP";

    @Column(name = "pin_hash", length = 100)
    private String pinHash;

    @Column(name = "pin_salt", length = 100)
    private String pinSalt;

    @Column(name = "pin_set_at")
    private LocalDateTime pinSetAt;

    @Column(name = "pin_fail_count", nullable = false)
    private int pinFailCount = 0;

    @Column(name = "pin_locked_until")
    private LocalDateTime pinLockedUntil;

    @Column(name = "last_login_at")
    private LocalDateTime lastLoginAt;

    // 대표별 투썸 자격증명 (twosome_pw는 AES-256-GCM으로 암호화해 저장)
    @Column(name = "twosome_id", length = 100)
    private String twosomeId;

    @Column(name = "twosome_pw", length = 500)
    private String twosomePw;

    @Column(name = "del_yn", nullable = false, length = 1)
    private String delYn = "N";

    @Column(name = "created_date", nullable = false, updatable = false)
    private LocalDateTime createdDate;

    @Column(name = "updated_date")
    private LocalDateTime updatedDate;

    @PrePersist
    protected void onCreate() {
        createdDate = LocalDateTime.now();
        updatedDate = LocalDateTime.now();
        if (delYn == null) {
            delYn = "N";
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedDate = LocalDateTime.now();
    }

    public boolean isPinSet() {
        return pinHash != null && !pinHash.isBlank();
    }

    /** PIN 잠금 중 여부 */
    public boolean isPinLocked() {
        return pinLockedUntil != null && pinLockedUntil.isAfter(LocalDateTime.now());
    }
}
