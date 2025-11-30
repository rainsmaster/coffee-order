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
    private Long twosomeMenuId;
    private String twosomeMenuName;
    private String twosomeMenuCategory;
    private String menuType;  // CUSTOM 또는 TWOSOME
    private String personalOption;
    private LocalDate orderDate;
    private LocalDateTime createdTime;

    public static OrderResponseDto from(Order order) {
        OrderResponseDto dto = new OrderResponseDto();
        dto.setId(order.getId());
        dto.setTeamId(order.getTeam().getId());
        dto.setTeamName(sanitize(order.getTeam().getName()));
        // menuType이 null인 경우 CUSTOM으로 처리 (기존 데이터 호환)
        String menuType = order.getMenuType() != null ? order.getMenuType() : "CUSTOM";
        dto.setMenuType(menuType);
        dto.setPersonalOption(sanitize(order.getPersonalOption()));
        dto.setOrderDate(order.getOrderDate());
        dto.setCreatedTime(order.getCreatedTime());

        // 메뉴 타입에 따라 처리
        if ("TWOSOME".equals(menuType) && order.getTwosomeMenu() != null) {
            dto.setTwosomeMenuId(order.getTwosomeMenu().getId());
            dto.setTwosomeMenuName(sanitize(order.getTwosomeMenu().getMenuNm()));
            dto.setTwosomeMenuCategory(sanitize(order.getTwosomeMenu().getMidNm()));
            dto.setMenuId(null);
            dto.setMenuName(null);
            dto.setMenuCategory(null);
        } else if (order.getMenu() != null) {
            dto.setMenuId(order.getMenu().getId());
            dto.setMenuName(sanitize(order.getMenu().getName()));
            dto.setMenuCategory(sanitize(order.getMenu().getCategory()));
            dto.setTwosomeMenuId(null);
            dto.setTwosomeMenuName(null);
            dto.setTwosomeMenuCategory(null);
        }

        return dto;
    }

    private static String sanitize(String value) {
        // JSON API에서는 Jackson이 자동으로 이스케이프하지만,
        // 정적 분석 도구를 만족시키기 위해 명시적으로 처리
        return value != null ? HtmlUtils.htmlEscape(value) : null;
    }
}