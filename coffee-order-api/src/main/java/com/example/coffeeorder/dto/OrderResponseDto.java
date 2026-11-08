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
    private String menuName;  // TWOSOME이면 twosomeMenu.menuNm, 레거시 CUSTOM이면 personal_option 값 (메뉴 이름 역할)
    private Long twosomeMenuId;
    private String twosomeMenuName;
    private String twosomeMenuCategory;
    private String twosomeMenuCode;  // 메뉴 옵션 조회용 코드
    private String menuType;  // 레거시 CUSTOM 주문 구분용 (신규 주문은 항상 TWOSOME)
    private String personalOption;
    private LocalDate orderDate;
    private LocalDateTime createdTime;
    private LocalDateTime cartReflectedAt;  // 장바구니 반영 일시 (null이면 미반영)
    private Long cartReflectedBy;
    private String variantMenuCd;
    private String variantOpts;
    private String cstmInfo;

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
        dto.setCartReflectedAt(order.getCartReflectedAt());
        dto.setCartReflectedBy(order.getCartReflectedBy());
        dto.setVariantMenuCd(order.getVariantMenuCd());
        dto.setVariantOpts(order.getVariantOpts());
        dto.setCstmInfo(order.getCstmInfo());

        // 메뉴 이름 결정: TWOSOME이면 투썸 메뉴 이름, 레거시 CUSTOM이면 personal_option 값을 메뉴 이름처럼 사용
        if ("TWOSOME".equals(menuType) && order.getTwosomeMenu() != null) {
            dto.setTwosomeMenuId(order.getTwosomeMenu().getId());
            dto.setTwosomeMenuName(sanitize(order.getTwosomeMenu().getMenuNm()));
            dto.setTwosomeMenuCategory(sanitize(order.getTwosomeMenu().getMidNm()));
            dto.setTwosomeMenuCode(order.getTwosomeMenu().getMenuCd());
            dto.setMenuName(dto.getTwosomeMenuName());
        } else {
            dto.setMenuName(dto.getPersonalOption());
        }

        return dto;
    }

    private static String sanitize(String value) {
        // JSON API에서는 Jackson이 자동으로 이스케이프하지만,
        // 정적 분석 도구를 만족시키기 위해 명시적으로 처리
        return value != null ? HtmlUtils.htmlEscape(value) : null;
    }
}