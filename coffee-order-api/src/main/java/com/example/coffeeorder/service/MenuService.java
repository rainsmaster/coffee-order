package com.example.coffeeorder.service;

import com.example.coffeeorder.entity.Menu;
import com.example.coffeeorder.repository.MenuRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class MenuService {

    private final MenuRepository menuRepository;

    // 삭제되지 않은 전체 메뉴 조회 (최근 3개월 주문 많은 순)
    public List<Menu> findAllActiveOrderByPopularity() {
        LocalDate threeMonthsAgo = LocalDate.now().minusMonths(3);
        return menuRepository.findAllOrderByRecentOrderCount(threeMonthsAgo);
    }

    // ID로 조회
    public Optional<Menu> findById(Long id) {
        return menuRepository.findById(id);
    }

    // 저장 (생성 & 수정)
    @Transactional
    public Menu save(Menu menu) {
        return menuRepository.save(menu);
    }

    // 소프트 삭제
    @Transactional
    public void softDelete(Long id) {
        Optional<Menu> menu = menuRepository.findById(id);
        menu.ifPresent(m -> {
            m.setDelYn("Y");
            menuRepository.save(m);
        });
    }
}
