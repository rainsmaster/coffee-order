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
    @JoinColumn(name = "team_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Team team;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "menu_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Menu menu;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "twosome_menu_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private TwosomeMenu twosomeMenu;

    @Column(name = "menu_type", length = 20)
    private String menuType = "CUSTOM";  // CUSTOM 또는 TWOSOME

    @Column(name = "personal_option", length = 500)
    private String personalOption;

    @Column(name = "order_date", nullable = false)
    private LocalDate orderDate;

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
            menuType = "CUSTOM";
        }
    }
}