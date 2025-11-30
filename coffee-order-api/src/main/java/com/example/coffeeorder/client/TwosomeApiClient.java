package com.example.coffeeorder.client;

import com.example.coffeeorder.dto.TwosomeMenuResponse;
import com.example.coffeeorder.dto.TwosomeSizeOptionResponse;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Component
@RequiredArgsConstructor
public class TwosomeApiClient {

    private static final String TWOSOME_MENU_API_URL = "https://mo.twosome.co.kr/mn/menuInfoListAjax.json";
    private static final String TWOSOME_MENU_DETAIL_URL = "https://mo.twosome.co.kr/mn/menuInfoDetail.do?menuCd=";
    private static final String TWOSOME_SIZE_OPT_API_URL = "https://mo.twosome.co.kr/mn/menuSizeOptListAjax.json";

    // 온도 옵션 추출 패턴: fn_ondoTabClick('010H') 또는 fn_ondoTabClick('011I')
    private static final Pattern ONDO_PATTERN = Pattern.compile("fn_ondoTabClick\\('(\\d{3}[HI])'\\)");

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    /**
     * 메뉴 리스트 조회
     */
    public TwosomeMenuResponse fetchMenuList() {
        log.info("Fetching menu list from Twosome API: {}", TWOSOME_MENU_API_URL);
        try {
            TwosomeMenuResponse response = restTemplate.getForObject(TWOSOME_MENU_API_URL, TwosomeMenuResponse.class);
            if (response != null && response.getQueryCode() == 1000) {
                log.info("Successfully fetched {} menus from Twosome API",
                    response.getFetchResultListSet() != null ? response.getFetchResultListSet().size() : 0);
            } else {
                log.warn("Twosome API returned unexpected response: {}", response);
            }
            return response;
        } catch (Exception e) {
            log.error("Failed to fetch menu list from Twosome API", e);
            throw new RuntimeException("Failed to fetch menu list from Twosome API", e);
        }
    }

    /**
     * 메뉴 상세 페이지에서 온도 옵션 추출
     * @param menuCd 메뉴 코드
     * @return 온도 옵션 코드 리스트 (예: ["010H", "010I"] 또는 ["011I"])
     */
    public List<String> fetchTemperatureOptions(String menuCd) {
        List<String> ondoOptions = new ArrayList<>();

        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(TWOSOME_MENU_DETAIL_URL + menuCd))
                    .timeout(Duration.ofSeconds(15))
                    .header("User-Agent", "Mozilla/5.0")
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 200) {
                String html = response.body();
                Matcher matcher = ONDO_PATTERN.matcher(html);

                while (matcher.find()) {
                    String ondoCode = matcher.group(1);
                    if (!ondoOptions.contains(ondoCode)) {
                        ondoOptions.add(ondoCode);
                    }
                }

                log.debug("Menu {} has temperature options: {}", menuCd, ondoOptions);
            } else {
                log.warn("Failed to fetch menu detail for {}: HTTP {}", menuCd, response.statusCode());
            }

        } catch (Exception e) {
            log.error("Error fetching temperature options for menu {}: {}", menuCd, e.getMessage());
        }

        return ondoOptions;
    }

    /**
     * 특정 온도에 대한 사이즈 옵션 조회
     * @param menuCd 메뉴 코드
     * @param ondoOpt 온도 옵션 코드 (예: "010H", "010I")
     * @return 사이즈 옵션 리스트
     */
    public List<TwosomeSizeOptionResponse> fetchSizeOptions(String menuCd, String ondoOpt) {
        try {
            String url = TWOSOME_SIZE_OPT_API_URL + "?menuCd=" + menuCd + "&ondoOpt=" + ondoOpt;

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(10))
                    .header("User-Agent", "Mozilla/5.0")
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 200) {
                String body = response.body();
                // HTML 응답인 경우 스킵
                if (body.trim().startsWith("<!DOCTYPE") || body.trim().startsWith("<html")) {
                    log.warn("Received HTML instead of JSON for menu {} ondoOpt {}", menuCd, ondoOpt);
                    return new ArrayList<>();
                }

                List<TwosomeSizeOptionResponse> sizeOptions = objectMapper.readValue(
                        body,
                        new TypeReference<List<TwosomeSizeOptionResponse>>() {}
                );

                log.debug("Menu {} (ondoOpt={}) has size options: {}", menuCd, ondoOpt, sizeOptions);
                return sizeOptions;
            } else {
                log.warn("Failed to fetch size options for menu {} ondoOpt {}: HTTP {}",
                        menuCd, ondoOpt, response.statusCode());
            }

        } catch (Exception e) {
            log.error("Error fetching size options for menu {} ondoOpt {}: {}",
                    menuCd, ondoOpt, e.getMessage());
        }

        return new ArrayList<>();
    }

    /**
     * 온도 코드를 한글명으로 변환
     */
    public static String getTemperatureName(String ondoOptCd) {
        if (ondoOptCd == null) return "";
        if (ondoOptCd.endsWith("H")) {
            return "핫";
        } else if (ondoOptCd.endsWith("I")) {
            return "아이스";
        }
        return ondoOptCd;
    }
}
