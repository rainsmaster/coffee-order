package com.example.coffeeorder.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "twosome_menu_option", indexes = {
    @Index(name = "idx_menu_option_menu_cd", columnList = "menu_cd"),
    @Index(name = "idx_menu_option_ondo", columnList = "menu_cd, ondo_opt_cd")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class TwosomeMenuOption {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "menu_cd", nullable = false, length = 20)
    private String menuCd;

    // 온도 옵션 (010H=핫, 010I=아이스, 011I=아이스전용 등)
    @Column(name = "ondo_opt_cd", nullable = false, length = 10)
    private String ondoOptCd;

    @Column(name = "ondo_opt_nm", length = 20)
    private String ondoOptNm;

    // 사이즈 옵션 (R=레귤러, L=라지, M=맥스)
    @Column(name = "size_opt_cd", nullable = false, length = 10)
    private String sizeOptCd;

    @Column(name = "size_opt_nm", length = 20)
    private String sizeOptNm;

    @Column(name = "size_opt_grp_cd", length = 10)
    private String sizeOptGrpCd;

    // 조합 코드 (020R, 020L, 020M)
    @Column(name = "opts", length = 20)
    private String opts;

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
