package com.example.coffeeorder.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "twosome_menu", uniqueConstraints =
        @UniqueConstraint(name = "uk_twosome_menu_cd_mid_cd", columnNames = {"menu_cd", "mid_cd"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class TwosomeMenu {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "menu_cd", nullable = false, length = 20)
    private String menuCd;

    @Column(name = "menu_nm", nullable = false, length = 200)
    private String menuNm;

    @Column(name = "en_menu_nm", length = 200)
    private String enMenuNm;

    @Column(name = "grt_cd", length = 10)
    private String grtCd;

    @Column(name = "grt_nm", length = 50)
    private String grtNm;

    @Column(name = "mid_cd", length = 10)
    private String midCd;

    @Column(name = "mid_nm", length = 50)
    private String midNm;

    @Column(name = "menu_img", length = 500)
    private String menuImg;

    @Column(name = "menu_img_01", length = 500)
    private String menuImg01;

    @Column(name = "menu_img_02", length = 500)
    private String menuImg02;

    @Column(name = "menu_img_03", length = 500)
    private String menuImg03;

    @Column(name = "badg_cd", length = 20)
    private String badgCd;

    @Column(name = "badg_nm", length = 50)
    private String badgNm;

    @Column(name = "sort_ord")
    private Integer sortOrd;

    @Column(name = "dm_display_no", length = 20)
    private String dmDisplayNo;

    // 로컬 저장 이미지 경로 (예: /images/twosome/10100001.jpg)
    @Column(name = "local_img_path", length = 500)
    private String localImgPath;

    // 매장 기반 신규 컬럼 (매장 메뉴 새로고침 시 채워짐. 미동기화 항목은 null)
    // 가격 (투썸이 매기지 못한 항목 방어용 null 허용)
    @Column(name = "sale_amt")
    private Integer saleAmt;

    // 판매 가능 수량 (-1이면 무제한)
    @Column(name = "sales_psbl_qty")
    private Integer salesPsblQty;

    // 기본 메뉴 코드 (변형 메뉴의 원본)
    @Column(name = "default_menu_cd", length = 20)
    private String defaultMenuCd;

    // 사용 시작일 (yyyyMMdd)
    @Column(name = "use_fr_dt", length = 8)
    private String useFrDt;

    // 메뉴 상세 페이지 파싱 옵션 데이터 (JSON, 캐시. 메뉴 새로고침 시 무효화)
    @Column(name = "option_data", columnDefinition = "TEXT")
    private String optionData;

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
}