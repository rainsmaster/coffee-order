package com.example.coffeeorder.repository;

import com.example.coffeeorder.entity.TwosomeMenuOption;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TwosomeMenuOptionRepository extends JpaRepository<TwosomeMenuOption, Long> {

    // 메뉴코드로 모든 옵션 조회
    List<TwosomeMenuOption> findByMenuCdAndDelYn(String menuCd, String delYn);

    // 메뉴코드와 온도로 사이즈 옵션 조회
    List<TwosomeMenuOption> findByMenuCdAndOndoOptCdAndDelYn(String menuCd, String ondoOptCd, String delYn);

    // 메뉴코드로 온도 옵션 목록 조회 (중복 제거)
    @Query("SELECT DISTINCT o.ondoOptCd, o.ondoOptNm FROM TwosomeMenuOption o WHERE o.menuCd = :menuCd AND o.delYn = 'N'")
    List<Object[]> findDistinctOndoOptByMenuCd(@Param("menuCd") String menuCd);

    // 메뉴코드로 옵션 삭제 (동기화 전 기존 데이터 삭제용)
    @Modifying
    @Query("DELETE FROM TwosomeMenuOption o WHERE o.menuCd = :menuCd")
    void deleteByMenuCd(@Param("menuCd") String menuCd);

    // 모든 옵션 삭제 (전체 동기화 전 삭제용)
    @Modifying
    @Query("DELETE FROM TwosomeMenuOption o")
    void deleteAllOptions();
}
