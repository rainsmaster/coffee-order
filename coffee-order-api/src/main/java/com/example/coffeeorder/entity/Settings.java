package com.example.coffeeorder.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;
import java.time.LocalTime;

@Entity
@Table(name = "settings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Settings {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_deadline_time")
    private LocalTime orderDeadlineTime;

    @Column(name = "is_24hours", nullable = false)
    private Boolean is24Hours = false;

    @Column(name = "updated_date")
    private LocalDateTime updatedDate;

    @PreUpdate
    @PrePersist
    protected void onUpdate() {
        updatedDate = LocalDateTime.now();
    }
}