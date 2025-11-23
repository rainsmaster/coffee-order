package com.example.coffeeorder.mapper;

import com.example.coffeeorder.dto.MenuSummaryDto;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDate;
import java.util.List;

@Mapper
public interface OrderMapper {

    /**
     * 날짜별 메뉴 집계 조회
     * @param orderDate 주문 날짜
     * @return 메뉴별 주문 집계 목록
     */
    List<MenuSummaryDto> findMenuSummaryByDate(@Param("orderDate") LocalDate orderDate);
}