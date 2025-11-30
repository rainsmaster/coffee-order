package com.example.coffeeorder.service;

import com.example.coffeeorder.entity.Department;
import com.example.coffeeorder.entity.Team;
import com.example.coffeeorder.repository.DepartmentRepository;
import com.example.coffeeorder.repository.TeamRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TeamService {

    private final TeamRepository teamRepository;
    private final DepartmentRepository departmentRepository;

    // 삭제되지 않은 전체 팀원 조회 (하위 호환용)
    public List<Team> findAllActive() {
        return teamRepository.findByDelYn("N");
    }

    // 부서별 팀원 조회
    public List<Team> findByDepartmentId(Long departmentId) {
        return teamRepository.findByDepartmentIdAndDelYnOrderByIdAsc(departmentId, "N");
    }

    // ID로 조회
    public Optional<Team> findById(Long id) {
        return teamRepository.findById(id);
    }

    // 저장 (생성 & 수정)
    @Transactional
    public Team save(Team team) {
        return teamRepository.save(team);
    }

    // 부서와 함께 팀원 생성
    @Transactional
    public Team createWithDepartment(Long departmentId, String name) {
        Department department = departmentRepository.findById(departmentId)
                .orElseThrow(() -> new RuntimeException("부서를 찾을 수 없습니다."));

        Team team = new Team();
        team.setDepartment(department);
        team.setName(name);
        return teamRepository.save(team);
    }

    // 소프트 삭제
    @Transactional
    public void softDelete(Long id) {
        Optional<Team> team = teamRepository.findById(id);
        team.ifPresent(t -> {
            t.setDelYn("Y");
            teamRepository.save(t);
        });
    }
}
