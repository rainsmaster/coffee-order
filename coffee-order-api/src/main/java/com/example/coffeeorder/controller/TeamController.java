package com.example.coffeeorder.controller;

import com.example.coffeeorder.entity.Team;
import com.example.coffeeorder.service.TeamService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/teams")
@RequiredArgsConstructor
@CrossOrigin(origins = "http://localhost:3000")
public class TeamController {

    private final TeamService teamService;

    // 팀원 조회 (부서별)
    @GetMapping
    public ResponseEntity<List<Team>> getTeams(
            @RequestParam(required = false) Long departmentId) {
        List<Team> teams;
        if (departmentId != null) {
            teams = teamService.findByDepartmentId(departmentId);
        } else {
            teams = teamService.findAllActive();
        }
        return ResponseEntity.ok(teams);
    }

    // ID로 조회
    @GetMapping("/{id}")
    public ResponseEntity<Team> getTeamById(@PathVariable Long id) {
        return teamService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // 팀원 생성
    @PostMapping
    public ResponseEntity<Team> createTeam(@RequestBody Map<String, Object> request) {
        Long departmentId = request.get("departmentId") != null
                ? Long.valueOf(request.get("departmentId").toString()) : null;
        String name = (String) request.get("name");

        if (name == null || name.trim().isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        Team savedTeam;
        if (departmentId != null) {
            savedTeam = teamService.createWithDepartment(departmentId, name.trim());
        } else {
            Team team = new Team();
            team.setName(name.trim());
            savedTeam = teamService.save(team);
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(savedTeam);
    }

    // 팀원 수정
    @PutMapping("/{id}")
    public ResponseEntity<Team> updateTeam(@PathVariable Long id, @RequestBody Team team) {
        return teamService.findById(id)
                .map(existingTeam -> {
                    existingTeam.setName(team.getName());
                    Team updatedTeam = teamService.save(existingTeam);
                    return ResponseEntity.ok(updatedTeam);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // 팀원 삭제 (소프트 삭제)
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTeam(@PathVariable Long id) {
        if (teamService.findById(id).isPresent()) {
            teamService.softDelete(id);
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.notFound().build();
    }
}
