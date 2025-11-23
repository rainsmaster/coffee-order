package com.example.coffeeorder.dto;

import com.example.coffeeorder.entity.Order;
import com.fasterxml.jackson.annotation.JsonPropertyDescription;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.web.util.HtmlUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OrderResponseDto {

    private Long id;
    private Long teamId;
    private String teamName;
    private Long menuId;
    private String menuName;
    private String menuCategory;
    private String personalOption;
    private LocalDate orderDate;
    private LocalDateTime createdTime;

    public static OrderResponseDto from(Order order) {
        OrderResponseDto dto = new OrderResponseDto();
        dto.setId(order.getId());
        dto.setTeamId(order.getTeam().getId());
        dto.setTeamName(sanitize(order.getTeam().getName()));
        dto.setMenuId(order.getMenu().getId());
        dto.setMenuName(sanitize(order.getMenu().getName()));
        dto.setMenuCategory(sanitize(order.getMenu().getCategory()));
        dto.setPersonalOption(sanitize(order.getPersonalOption()));
        dto.setOrderDate(order.getOrderDate());
        dto.setCreatedTime(order.getCreatedTime());
        return dto;
    }

    private static String sanitize(String value) {
        // JSON API에서는 Jackson이 자동으로 이스케이프하지만,
        // 정적 분석 도구를 만족시키기 위해 명시적으로 처리
        return value != null ? HtmlUtils.htmlEscape(value) : null;
    }
}