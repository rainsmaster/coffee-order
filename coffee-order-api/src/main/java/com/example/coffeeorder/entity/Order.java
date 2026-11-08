package com.example.coffeeorder.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "orders")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "department_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Department department;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "team_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Team team;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "twosome_menu_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private TwosomeMenu twosomeMenu;

    // 레거시 CUSTOM 주문 구분용 (런칭 초반 2025-11-30~12-02 6걸음). 신규 주문은 항상 TWOSOME
    @Column(name = "menu_type", length = 20)
    private String menuType = "TWOSOME";

    @Column(name = "personal_option", length = 500)
    private String personalOption;

    @Column(name = "order_date", nullable = false)
    private LocalDate orderDate;

    // 장바구니 반영 일시 (null이면 미반영 — 일괄 담기 대상)
    @Column(name = "cart_reflected_at")
    private LocalDateTime cartReflectedAt;

    @Column(name = "cart_reflected_by")
    private Long cartReflectedBy;

    // 투썸 변형 메뉴 코드 (옵션 조합 결과, 장바구니 담기의 MENU_CD)
    @Column(name = "variant_menu_cd", length = 20)
    private String variantMenuCd;

    // 옵션 코드 콤마 조합 ("010H,020R,040A,051E")
    @Column(name = "variant_opts", length = 100)
    private String variantOpts;

    // 투썸 퍼스널 옵션 JSON (cartCstmInfo 배열 스냅샷)
    @Column(name = "cstm_info", columnDefinition = "TEXT")
    private String cstmInfo;

    @Column(name = "del_yn", nullable = false, length = 1)
    private String delYn = "N";

    @Column(name = "created_time", nullable = false, updatable = false)
    private LocalDateTime createdTime;

    @PrePersist
    protected void onCreate() {
        createdTime = LocalDateTime.now();
        if (orderDate == null) {
            orderDate = LocalDate.now();
        }
        if (delYn == null) {
            delYn = "N";
        }
        if (menuType == null) {
            menuType = "TWOSOME";
        }
    }
}