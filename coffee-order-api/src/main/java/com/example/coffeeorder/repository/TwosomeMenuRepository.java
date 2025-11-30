package com.example.coffeeorder.repository;

import com.example.coffeeorder.entity.TwosomeMenu;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TwosomeMenuRepository extends JpaRepository<TwosomeMenu, Long> {

    // 삭제되지 않은 메뉴 조회 (중분류별 정렬)
    List<TwosomeMenu> findByDelYnOrderByMidNmAscSortOrdAsc(String delYn);

    // 메뉴코드로 조회
    Optional<TwosomeMenu> findByMenuCd(String menuCd);

    // 중분류명으로 조회
    List<TwosomeMenu> findByMidNmAndDelYnOrderBySortOrdAsc(String midNm, String delYn);

    // 대분류명으로 조회
    List<TwosomeMenu> findByGrtNmAndDelYnOrderByMidNmAscSortOrdAsc(String grtNm, String delYn);

    // 메뉴코드 존재 여부 확인
    boolean existsByMenuCd(String menuCd);
}