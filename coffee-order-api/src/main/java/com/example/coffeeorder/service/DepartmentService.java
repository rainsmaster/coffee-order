package com.example.coffeeorder.service;

import com.example.coffeeorder.dto.DepartmentDto;
import com.example.coffeeorder.entity.Department;
import com.example.coffeeorder.repository.DepartmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DepartmentService {

    private final DepartmentRepository departmentRepository;

    // 전체 팀 목록 조회 (삭제되지 않은 것만)
    public List<DepartmentDto> findAll() {
        return departmentRepository.findByDelYnOrderByIdAsc("N")
                .stream()
                .map(DepartmentDto::from)
                .collect(Collectors.toList());
    }

    // ID로 조회
    public Optional<DepartmentDto> findById(Long id) {
        return departmentRepository.findByIdAndDelYn(id, "N")
                .map(DepartmentDto::from);
    }

    // 팀 생성
    @Transactional
    public DepartmentDto create(String name) {
        Department department = new Department();
        department.setName(name);
        Department saved = departmentRepository.save(department);
        return DepartmentDto.from(saved);
    }

    // 팀 이름 수정
    @Transactional
    public Optional<DepartmentDto> update(Long id, String name) {
        return departmentRepository.findByIdAndDelYn(id, "N")
                .map(department -> {
                    department.setName(name);
                    return DepartmentDto.from(departmentRepository.save(department));
                });
    }

    // 팀 소프트 삭제
    @Transactional
    public boolean softDelete(Long id) {
        return departmentRepository.findByIdAndDelYn(id, "N")
                .map(department -> {
                    department.setDelYn("Y");
                    departmentRepository.save(department);
                    return true;
                })
                .orElse(false);
    }

    // 팀 존재 여부 확인
    public boolean existsById(Long id) {
        return departmentRepository.findByIdAndDelYn(id, "N").isPresent();
    }
}
