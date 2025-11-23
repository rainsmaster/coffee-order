package com.example.coffeeorder.service;

import com.example.coffeeorder.entity.Team;
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

    // 삭제되지 않은 전체 팀원 조회
    public List<Team> findAllActive() {
        return teamRepository.findByDelYn("N");
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

    // 소프트 삭제
    @Transactional
    public void softDelete(Long id) {
        Optional<Team> team = teamRepository.findById(id);
        team.ifPresent(t -> {
            t.setDelYn("Y");
            teamRepository.save(t);
        });
    }

    // 전체 개수
    public long count() {
        return teamRepository.count();
    }
}
