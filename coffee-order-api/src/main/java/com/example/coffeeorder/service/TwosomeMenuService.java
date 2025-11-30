package com.example.coffeeorder.service;

import com.example.coffeeorder.entity.TwosomeMenu;
import com.example.coffeeorder.repository.TwosomeMenuRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TwosomeMenuService {

    private final TwosomeMenuRepository twosomeMenuRepository;

    // 삭제되지 않은 전체 메뉴 조회
    public List<TwosomeMenu> findAllActive() {
        return twosomeMenuRepository.findByDelYnOrderByMidNmAscSortOrdAsc("N");
    }

    // ID로 조회
    public Optional<TwosomeMenu> findById(Long id) {
        return twosomeMenuRepository.findById(id);
    }

    // 메뉴코드로 조회
    public Optional<TwosomeMenu> findByMenuCd(String menuCd) {
        return twosomeMenuRepository.findByMenuCd(menuCd);
    }

    // 중분류명으로 조회
    public List<TwosomeMenu> findByMidNm(String midNm) {
        return twosomeMenuRepository.findByMidNmAndDelYnOrderBySortOrdAsc(midNm, "N");
    }

    // 대분류명으로 조회
    public List<TwosomeMenu> findByGrtNm(String grtNm) {
        return twosomeMenuRepository.findByGrtNmAndDelYnOrderByMidNmAscSortOrdAsc(grtNm, "N");
    }

    // 저장 (생성 & 수정)
    @Transactional
    public TwosomeMenu save(TwosomeMenu menu) {
        return twosomeMenuRepository.save(menu);
    }

    // 일괄 저장
    @Transactional
    public List<TwosomeMenu> saveAll(List<TwosomeMenu> menus) {
        return twosomeMenuRepository.saveAll(menus);
    }

    // 메뉴코드 존재 여부 확인
    public boolean existsByMenuCd(String menuCd) {
        return twosomeMenuRepository.existsByMenuCd(menuCd);
    }

    // 소프트 삭제
    @Transactional
    public void softDelete(Long id) {
        Optional<TwosomeMenu> menu = twosomeMenuRepository.findById(id);
        menu.ifPresent(m -> {
            m.setDelYn("Y");
            twosomeMenuRepository.save(m);
        });
    }
}