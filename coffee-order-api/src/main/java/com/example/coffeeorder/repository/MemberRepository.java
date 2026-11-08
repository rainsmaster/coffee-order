package com.example.coffeeorder.repository;

import com.example.coffeeorder.entity.Member;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MemberRepository extends JpaRepository<Member, Long> {

    // 활성 대표 목록 (로그인 화면용/관리자 목록용)
    List<Member> findByDelYnOrderByIdAsc(String delYn);

    Optional<Member> findByIdAndDelYn(Long id, String delYn);

    Optional<Member> findByTeam_IdAndDelYn(Long teamId, String delYn);

    List<Member> findByTeam_Department_IdAndDelYnOrderByIdAsc(Long departmentId, String delYn);
}
