package com.example.coffeeorder.repository;

import com.example.coffeeorder.entity.Department;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DepartmentRepository extends JpaRepository<Department, Long> {

    // 삭제되지 않은 팀 목록 조회
    List<Department> findByDelYnOrderByIdAsc(String delYn);

    // ID와 삭제 여부로 조회
    Optional<Department> findByIdAndDelYn(Long id, String delYn);

    // 이름으로 조회 (중복 체크용)
    Optional<Department> findByNameAndDelYn(String name, String delYn);
}
