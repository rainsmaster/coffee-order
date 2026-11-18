package com.example.coffeeorder.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "external_order_item", uniqueConstraints = {
        @UniqueConstraint(name = "uk_external_order_item_line", columnNames = {"external_order_id", "ord_dtl_no"})
})
@Getter
@Setter
@NoArgsConstructor
public class ExternalOrderItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "external_order_id", nullable = false)
    private Long externalOrderId;

    @Column(name = "ord_dtl_no", nullable = false, length = 20)
    private String ordDtlNo;

    @Column(name = "menu_cd", nullable = false, length = 20)
    private String menuCd;

    @Column(name = "menu_nm", length = 200)
    private String menuNm;

    @Column(name = "option_nm", length = 1000)
    private String optionNm;

    @Column(nullable = false)
    private int quantity;

    @Column(name = "display_unit_price")
    private Integer displayUnitPrice;

    @Column(name = "display_line_amount")
    private Integer displayLineAmount;

    @Column(name = "custom_options_json", columnDefinition = "TEXT")
    private String customOptionsJson;
}
