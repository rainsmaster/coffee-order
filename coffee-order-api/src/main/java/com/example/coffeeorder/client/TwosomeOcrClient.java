package com.example.coffeeorder.client;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * OCR 사이드카(ocr-service) 호출 클라이언트.
 *
 * POST {twosome.ocr.url}/ocr/captcha 에 PNG 바이트를 별내고
 * {"digits":"123456"} 또는 {"digits":null} 을 받는다.
 * 사이드카 장애/인식 실패는 로그만 남기고 null 을 반환해
 * 호출측(자동 재로그인)이 새 캡차로 재시도할 수 있게 한다.
 */
@Slf4j
@Component
public class TwosomeOcrClient {

    private static final int CONNECT_TIMEOUT_MS = 3000;
    private static final int READ_TIMEOUT_MS = 5000;

    private final RestClient restClient;

    public TwosomeOcrClient(@Value("${twosome.ocr.url:http://localhost:8090}") String ocrUrl) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(CONNECT_TIMEOUT_MS);
        requestFactory.setReadTimeout(READ_TIMEOUT_MS);
        this.restClient = RestClient.builder()
                .baseUrl(ocrUrl)
                .requestFactory(requestFactory)
                .build();
    }

    /**
     * 캡차 PNG 바이트에서 6자리 숫자를 인식한다.
     *
     * @return 6자리 숫자, 실패/사이드카 장애 시 null
     */
    public String recognizeCaptcha(byte[] pngBytes) {
        try {
            OcrResponse response = restClient.post()
                    .uri("/ocr/captcha")
                    .contentType(MediaType.IMAGE_PNG)
                    .body(pngBytes)
                    .retrieve()
                    .body(OcrResponse.class);
            return (response != null) ? response.digits() : null;
        } catch (Exception e) {
            log.warn("Twosome OCR sidecar call failed (ignored): {}", e.getMessage());
            return null;
        }
    }

    private record OcrResponse(String digits) {
    }
}
