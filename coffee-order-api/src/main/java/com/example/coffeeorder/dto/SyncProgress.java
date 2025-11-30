package com.example.coffeeorder.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SyncProgress implements Serializable {

    private static final long serialVersionUID = 1L;

    // 동기화 상태
    public enum Status {
        IDLE,       // 대기 중 (동기화 안 함)
        RUNNING,    // 진행 중
        COMPLETED,  // 완료
        FAILED      // 실패
    }

    // 현재 단계
    public enum Step {
        NONE,           // 없음
        MENU_SYNC,      // 1단계: 메뉴 동기화
        IMAGE_DOWNLOAD, // 2단계: 이미지 다운로드
        OPTION_CLEAR,   // 3단계: 옵션 초기화
        OPTION_SYNC     // 4단계: 옵션 동기화
    }

    private Status status;
    private Step currentStep;
    private String currentStepName;

    // 전체 진행률 (0-100)
    private int overallProgress;

    // 현재 단계 상세 정보
    private int currentStepProgress;    // 현재 단계 진행률 (0-100)
    private int processedCount;         // 처리된 항목 수
    private int totalCount;             // 전체 항목 수

    // 결과 정보
    private int menuCount;
    private int insertedCount;
    private int updatedCount;
    private int imageCount;
    private int optionCount;

    // 시간 정보
    private LocalDateTime startedAt;
    private LocalDateTime completedAt;
    private long elapsedTimeMs;

    // 오류 메시지 (실패 시)
    private String errorMessage;

    // 기본 상태 생성
    public static SyncProgress idle() {
        return SyncProgress.builder()
                .status(Status.IDLE)
                .currentStep(Step.NONE)
                .currentStepName("대기 중")
                .overallProgress(0)
                .build();
    }

    // 시작 상태 생성
    public static SyncProgress started() {
        return SyncProgress.builder()
                .status(Status.RUNNING)
                .currentStep(Step.MENU_SYNC)
                .currentStepName("메뉴 동기화 중")
                .overallProgress(0)
                .startedAt(LocalDateTime.now())
                .build();
    }

    // 단계별 진행률 업데이트 헬퍼
    public void updateStep(Step step, int processed, int total) {
        this.currentStep = step;
        this.processedCount = processed;
        this.totalCount = total;

        if (total > 0) {
            this.currentStepProgress = (processed * 100) / total;
        }

        // 전체 진행률 계산 (4단계 기준)
        int stepWeight = switch (step) {
            case MENU_SYNC -> 10;       // 1단계: 10%
            case IMAGE_DOWNLOAD -> 40;  // 2단계: 40%
            case OPTION_CLEAR -> 5;     // 3단계: 5%
            case OPTION_SYNC -> 45;     // 4단계: 45%
            default -> 0;
        };

        int baseProgress = switch (step) {
            case MENU_SYNC -> 0;
            case IMAGE_DOWNLOAD -> 10;
            case OPTION_CLEAR -> 50;
            case OPTION_SYNC -> 55;
            default -> 0;
        };

        this.overallProgress = baseProgress + (stepWeight * currentStepProgress / 100);

        this.currentStepName = switch (step) {
            case MENU_SYNC -> "메뉴 동기화 중";
            case IMAGE_DOWNLOAD -> String.format("이미지 다운로드 중 (%d/%d)", processed, total);
            case OPTION_CLEAR -> "옵션 초기화 중";
            case OPTION_SYNC -> String.format("옵션 동기화 중 (%d/%d)", processed, total);
            default -> "대기 중";
        };
    }
}
