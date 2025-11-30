package com.example.coffeeorder.controller;

import com.example.coffeeorder.entity.PersonalOption;
import com.example.coffeeorder.service.PersonalOptionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/personal-options")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:3000")
public class PersonalOptionController {

    private final PersonalOptionService personalOptionService;

    // 전체 옵션 조회 (카테고리별 그룹화)
    @GetMapping
    public ResponseEntity<Map<String, List<PersonalOption>>> getAllOptions() {
        Map<String, List<PersonalOption>> groupedOptions = personalOptionService.findAllActiveGroupedByCategory();
        return ResponseEntity.ok(groupedOptions);
    }

    // 전체 옵션 조회 (리스트)
    @GetMapping("/list")
    public ResponseEntity<List<PersonalOption>> getAllOptionsList() {
        List<PersonalOption> options = personalOptionService.findAllActive();
        return ResponseEntity.ok(options);
    }

    // ID로 조회
    @GetMapping("/{id}")
    public ResponseEntity<PersonalOption> getOptionById(@PathVariable Long id) {
        return personalOptionService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // 카테고리별 조회
    @GetMapping("/category/{category}")
    public ResponseEntity<List<PersonalOption>> getOptionsByCategory(@PathVariable String category) {
        List<PersonalOption> options = personalOptionService.findByCategory(category);
        return ResponseEntity.ok(options);
    }

    // 옵션 생성
    @PostMapping
    public ResponseEntity<PersonalOption> createOption(@RequestBody PersonalOption option) {
        PersonalOption savedOption = personalOptionService.save(option);
        return ResponseEntity.status(HttpStatus.CREATED).body(savedOption);
    }

    // 옵션 수정
    @PutMapping("/{id}")
    public ResponseEntity<PersonalOption> updateOption(@PathVariable Long id, @RequestBody PersonalOption option) {
        return personalOptionService.findById(id)
                .map(existingOption -> {
                    existingOption.setName(option.getName());
                    existingOption.setCategory(option.getCategory());
                    existingOption.setSortOrd(option.getSortOrd());
                    PersonalOption updatedOption = personalOptionService.save(existingOption);
                    return ResponseEntity.ok(updatedOption);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // 옵션 삭제 (소프트 삭제)
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteOption(@PathVariable Long id) {
        if (personalOptionService.findById(id).isPresent()) {
            personalOptionService.softDelete(id);
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }
}