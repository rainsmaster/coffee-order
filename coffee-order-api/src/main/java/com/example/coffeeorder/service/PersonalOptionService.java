package com.example.coffeeorder.service;

import com.example.coffeeorder.entity.PersonalOption;
import com.example.coffeeorder.repository.PersonalOptionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PersonalOptionService {

    private final PersonalOptionRepository personalOptionRepository;

    // 전체 옵션 조회
    public List<PersonalOption> findAllActive() {
        return personalOptionRepository.findByDelYnOrderByCategoryAscSortOrdAsc("N");
    }

    // 카테고리별 그룹화하여 조회
    public Map<String, List<PersonalOption>> findAllActiveGroupedByCategory() {
        List<PersonalOption> options = findAllActive();
        return options.stream()
                .collect(Collectors.groupingBy(
                        option -> option.getCategory() != null ? option.getCategory() : "기타"
                ));
    }

    // ID로 조회
    public Optional<PersonalOption> findById(Long id) {
        return personalOptionRepository.findById(id);
    }

    // 카테고리별 조회
    public List<PersonalOption> findByCategory(String category) {
        return personalOptionRepository.findByCategoryAndDelYnOrderBySortOrdAsc(category, "N");
    }

    // 저장 (생성 & 수정)
    @Transactional
    public PersonalOption save(PersonalOption option) {
        return personalOptionRepository.save(option);
    }

    // 소프트 삭제
    @Transactional
    public void softDelete(Long id) {
        Optional<PersonalOption> option = personalOptionRepository.findById(id);
        option.ifPresent(o -> {
            o.setDelYn("Y");
            personalOptionRepository.save(o);
        });
    }
}