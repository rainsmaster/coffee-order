package com.example.coffeeorder;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import jakarta.annotation.PostConstruct;
import java.util.TimeZone;

@SpringBootApplication
public class CoffeeOrderApplication {

    @PostConstruct
    public void init() {
        // 애플리케이션 전체 타임존을 한국 시간으로 설정
        TimeZone.setDefault(TimeZone.getTimeZone("Asia/Seoul"));
    }

    public static void main(String[] args) {
        SpringApplication.run(CoffeeOrderApplication.class, args);
    }

}
