package com.example.coffeeorder.repository;

import com.example.coffeeorder.entity.TwosomeMenu;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TwosomeMenuRepository extends JpaRepository<TwosomeMenu, Long> {

    // 삭제되지 않은 메뉴 조회 (중분류별 정렬)
    List<TwosomeMenu> findByDelYnOrderByMidNmAscSortOrdAsc(String delYn);

    // 같은 기본 코드라도 중분류가 다륩면 별도 매장 메뉴로 조회
    Optional<TwosomeMenu> findByMenuCdAndMidCd(String menuCd, String midCd);

    // 중분류를 알 수 없는 기존 주문·API의 하위 호환 조회
    Optional<TwosomeMenu> findFirstByMenuCdOrderByIdAsc(String menuCd);

    // 매장 메뉴 목록 (주문 페이지용): del_yn='N' AND 매장 배치 저장분
    // (sale_amt/sales_psbl_qty/default_menu_cd 중 하나라도 채워진 행 = 매장 목록에 있던 메뉴)
    @Query("SELECT m FROM TwosomeMenu m WHERE m.delYn = 'N' "
            + "AND (m.saleAmt IS NOT NULL OR m.salesPsblQty IS NOT NULL OR m.defaultMenuCd IS NOT NULL) "
            + "ORDER BY m.midNm ASC, m.sortOrd ASC")
    List<TwosomeMenu> findStoreMenus();

    // 중분류명으로 조회
    List<TwosomeMenu> findByMidNmAndDelYnOrderBySortOrdAsc(String midNm, String delYn);

    // 대분류명으로 조회
    List<TwosomeMenu> findByGrtNmAndDelYnOrderByMidNmAscSortOrdAsc(String grtNm, String delYn);

    // 메뉴코드 존재 여부 확인
    boolean existsByMenuCd(String menuCd);
}