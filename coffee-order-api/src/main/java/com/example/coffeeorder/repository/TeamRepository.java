package com.example.coffeeorder.repository;

import com.example.coffeeorder.entity.Department;
import com.example.coffeeorder.entity.Team;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TeamRepository extends JpaRepository<Team, Long> {
    List<Team> findByDelYn(String delYn);

    // 부서별 팀원 조회
    List<Team> findByDepartmentAndDelYnOrderByIdAsc(Department department, String delYn);

    // 부서 ID와 삭제 여부로 조회
    List<Team> findByDepartmentIdAndDelYnOrderByIdAsc(Long departmentId, String delYn);

    // ID와 부서로 조회
    Optional<Team> findByIdAndDepartment(Long id, Department department);
}