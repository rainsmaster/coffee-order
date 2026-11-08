package com.example.coffeeorder.client;

import lombok.Getter;

import java.net.http.HttpClient;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 투썸 모바일웹 세션 컨텍스트.
 * 로그인 페이지 진입 ~ 로그인/장바구니 담기까지 한 세션의 모든 호출에서 공유한다.
 *
 * CookieManager를 쓰지 않는 이유: 투썸이 발급하는 tsat/tsmn/wr_token 쿠키를
 * JDK CookieManager가 RFC 2965(v1) 형식(값 따옴표 + $Path/$Domain)으로 변형해
 * 전송하면 /mn/, /ts/ 계열 엔드포인트가 403 Access denied를 반환하기 때문.
 * Set-Cookie를 직접 파싱해 Netscape 형식 Cookie 헤더로만 복원해 본다.
 */
@Getter
public class TwosomeStoreSessionContext {

    private final HttpClient httpClient;
    private final Map<String, String> cookieJar = new LinkedHashMap<>();

    public TwosomeStoreSessionContext() {
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    public String getCookieHeader() {
        if (cookieJar.isEmpty()) {
            return null;
        }
        return cookieJar.entrySet().stream()
                .map(e -> e.getKey() + "=" + e.getValue())
                .collect(Collectors.joining("; "));
    }

    public void storeCookies(HttpResponse<?> response) {
        List<String> setCookies = response.headers().allValues("set-cookie");
        for (String sc : setCookies) {
            String pair = sc.split(";", 2)[0];
            int idx = pair.indexOf('=');
            if (idx > 0) {
                cookieJar.put(pair.substring(0, idx).trim(), pair.substring(idx + 1).trim());
            }
        }
    }
}
