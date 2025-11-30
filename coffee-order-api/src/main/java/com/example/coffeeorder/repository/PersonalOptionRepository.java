package com.example.coffeeorder.repository;

import com.example.coffeeorder.entity.PersonalOption;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PersonalOptionRepository extends JpaRepository<PersonalOption, Long> {

    // 삭제되지 않은 옵션 조회 (카테고리, 정렬순서 기준)
    List<PersonalOption> findByDelYnOrderByCategoryAscSortOrdAsc(String delYn);

    // 카테고리별 조회
    List<PersonalOption> findByCategoryAndDelYnOrderBySortOrdAsc(String category, String delYn);

    // 카테고리 목록 조회
    List<String> findDistinctCategoryByDelYn(String delYn);
}