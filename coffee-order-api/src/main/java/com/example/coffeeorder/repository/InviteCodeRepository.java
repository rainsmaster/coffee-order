package com.example.coffeeorder.repository;

import com.example.coffeeorder.entity.InviteCode;
import com.example.coffeeorder.entity.Member;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface InviteCodeRepository extends JpaRepository<InviteCode, Long> {

    // 멤버별 코드 목록 (미사용 유효 코드 필터링은 서비스에서)
    List<InviteCode> findByMember(Member member);
}
