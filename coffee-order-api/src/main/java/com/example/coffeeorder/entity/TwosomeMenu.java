package com.example.coffeeorder.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "twosome_menu")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class TwosomeMenu {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "menu_cd", unique = true, nullable = false, length = 20)
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