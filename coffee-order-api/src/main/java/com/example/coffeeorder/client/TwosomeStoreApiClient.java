package com.example.coffeeorder.client;

import com.example.coffeeorder.dto.TwosomeMenuResponse;
import com.example.coffeeorder.exception.TwosomeStoreException;
import com.example.coffeeorder.exception.TwosomeStoreSessionExpiredException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 투썸플레이스 모바일웹(mo.twosome.co.kr) 리버스 엔지니어링 클라이언트.
 *
 * 서버가 앱 세션을 발급하는 핵심 조건:
 * - User-Agent에 "iosapp/4.6.4" 포함
 * - X-Requested-With: XMLHttpRequest
 * - 한 세션의 모든 호출에서 쿠키 유지 (TwosomeStoreSessionContext)
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TwosomeStoreApiClient {

    private static final String BASE_URL = "https://mo.twosome.co.kr";
    private static final String LOGIN_PAGE_URL = BASE_URL + "/mb/login.do";
    private static final String CAPTCHA_IMG_URL = BASE_URL + "/mb/captchaImg.do";
    private static final String LOGIN_PROC_URL = BASE_URL + "/mb/loginProcAjax.json";
    private static final String SET_STORE_URL = BASE_URL + "/mn/setStoreInfoAjax.json";
    private static final String STORE_MENU_URL = BASE_URL + "/ts/selectTsTwMenuListCache.json";
    private static final String CART_URL = BASE_URL + "/od/processMenuCartAjax.json";
    private static final String CART_LIST_URL = BASE_URL + "/ts/getCartStoreMenuListAjax.json";
    private static final String CART_DELETE_URL = BASE_URL + "/od/deleteMenuCartAjax.json";
    private static final String CART_CUSTOM_LIST_URL = BASE_URL + "/od/getMenuCustomListAjax.json";
    private static final String MENU_DETAIL_URL = BASE_URL + "/ts/tsTsoMenuDetail.do";
    private static final String RESOLVE_VARIANT_URL = BASE_URL + "/mn/getNewMenuInfoAjax.json";
    private static final String MENU_CUSTOM_OPTIONS_URL = BASE_URL + "/ts/tsTsoMenuCustomListAjax.json";
    private static final String STORE_DETAIL_URL = BASE_URL + "/ts/storeDetailInfoAjax.json";
    private static final String LOGOUT_URL = BASE_URL + "/mb/logoutProc.do";

    private static final String USER_AGENT =
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 iosapp/4.6.4";
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(15);

    private final ObjectMapper objectMapper;

    /**
     * 로그인 페이지를 먼저 호출해 세션 쿠키를 발급받은 뒤 캡차 이미지를 가져온다.
     * 캡차는 세션에 바인딩되므로 반드시 같은 컨텍스트로 이어가야 한다.
     *
     * @return PNG 이미지 바이트
     */
    public byte[] fetchCaptchaImage(TwosomeStoreSessionContext context) {
        // 세션 쿠키 발급용 로그인 페이지 진입
        send(context, buildGet(LOGIN_PAGE_URL), "login page");

        HttpResponse<byte[]> response = send(context,
                buildGet(CAPTCHA_IMG_URL), "captcha image", HttpResponse.BodyHandlers.ofByteArray());

        byte[] image = response.body();
        if (image == null || image.length == 0) {
            throw new TwosomeStoreException("캡차 이미지를 받아오지 못했습니다.");
        }
        return image;
    }

    /**
     * 로그인 처리. 성공 시 {"rst":"S","rstCd":"000"}
     *
     * @return 성공 여부 (rst == "S")
     */
    public boolean login(TwosomeStoreSessionContext context, String loginId, String loginPwd, String answerCd) {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("loginId", loginId);
        params.put("loginPwd", loginPwd);
        params.put("answerCd", answerCd);
        params.put("accessDevice", "IOS_APP");

        HttpResponse<String> response = send(context,
                buildPostForm(LOGIN_PROC_URL, params), "login");

        JsonNode body = readTree(response.body(), "login");
        String rst = text(body, "rst");
        String rstCd = text(body, "rstCd");
        String msg = text(body, "rstMsg");
        log.info("Twosome login result: rst={}, rstCd={}", rst, rstCd);

        if ("S".equals(rst)) {
            return true;
        }
        throw new TwosomeStoreException(
                (msg != null && !msg.isBlank()) ? msg : "로그인에 실패했습니다. (rstCd=" + rstCd + ")", rstCd);
    }

    /**
     * 매장 세션 설정 → 응답의 storeNm 반환
     */
    public String setStoreInfo(TwosomeStoreSessionContext context, String storeCd, double lat, double longi) {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("storeCd", storeCd);
        params.put("lat", String.valueOf(lat));
        params.put("longi", String.valueOf(longi));

        HttpResponse<String> response = send(context,
                buildPostForm(SET_STORE_URL, params), "setStoreInfo");

        JsonNode body = readTree(response.body(), "setStoreInfo");
        String storeNm = text(body, "storeNm");
        log.info("Twosome store set: {} ({})", storeNm, storeCd);
        return storeNm;
    }

    /**
     * 매장 판매 메뉴 목록 조회 → {"queryCode":1000,"fetchResultListSet":[...]}
     */
    public TwosomeMenuResponse fetchStoreMenus(TwosomeStoreSessionContext context, String storeCd) {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("storeCd", storeCd);

        HttpResponse<String> response = send(context,
                buildPostForm(STORE_MENU_URL, params), "store menu list");

        try {
            TwosomeMenuResponse menuResponse =
                    objectMapper.readValue(response.body(), TwosomeMenuResponse.class);
            if (menuResponse.getQueryCode() != 1000) {
                throw new TwosomeStoreException(
                        "매장 메뉴 조회에 실패했습니다. (queryCode=" + menuResponse.getQueryCode() + ")");
            }
            return menuResponse;
        } catch (IOException e) {
            throw new TwosomeStoreException("매장 메뉴 응답을 해석하지 못했습니다.", e);
        }
    }

    /**
     * 장바구니 담기. cartInfo 값은 JSON 문자열.
     *
     * @return resultCd ("0000"이면 성공) 와 resultMsg
     */
    public CartAddResult addToCart(TwosomeStoreSessionContext context, String cartInfoJson) {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("cartInfo", cartInfoJson);

        HttpResponse<String> response = send(context,
                buildPostForm(CART_URL, params), "add to cart");

        JsonNode body = readTree(response.body(), "add to cart");
        String resultCd = text(body, "resultCd");
        String resultMsg = text(body, "resultMsg");
        return new CartAddResult("0000".equals(resultCd), resultCd, resultMsg);
    }

    /**
     * 옵션 그룹 의존성 조회 (menuOptListAjax). 선택한 옵션 기준 미선택 그룹의 가능 선택지를 반환.
     * 실측 요청: opts[]=010H&groupOptCds[]=010&menuCd=10100001 → 사이즈/원두/컵의 가능 OPTS 목록
     */
    public JsonNode fetchAvailableOptions(TwosomeStoreSessionContext context, String menuCd,
                                          List<String> opts, List<String> groupOptCds) {
        List<String[]> pairs = new ArrayList<>();
        for (String opt : opts) {
            pairs.add(new String[]{"opts[]", opt});
        }
        for (String grp : groupOptCds) {
            pairs.add(new String[]{"groupOptCds[]", grp});
        }
        pairs.add(new String[]{"menuCd", menuCd});
        HttpResponse<String> response = send(context,
                buildPostFormPairs(BASE_URL + "/mn/menuOptListAjax.json", pairs), "menu opt list");
        return readTree(response.body(), "menu opt list");
    }

    /**
     * 로그아웃 (선택)
     */
    public void logout(TwosomeStoreSessionContext context) {
        try {
            send(context, buildGet(LOGOUT_URL), "logout");
        } catch (Exception e) {
            log.warn("Twosome logout failed (ignored): {}", e.getMessage());
        }
    }

    /**
     * 장바구니 목록 조회. 로그인 세션 필요.
     *
     * @return 응답 JSON 전체 ({"resultCd":"0000","cartStoreMenuList":[...]} 형태, 실측 확인)
     */
    public JsonNode fetchCartList(TwosomeStoreSessionContext context, String storeCd) {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("storeCd", storeCd);
        params.put("cartGbcd", "10");

        HttpResponse<String> response = send(context,
                buildPostForm(CART_LIST_URL, params), "cart list");

        JsonNode body = readTree(response.body(), "cart list");
        String resultCd = body.path("resultCd").asText("");
        if (!"0000".equals(resultCd)) {
            throw new TwosomeStoreException(
                    "장바구니 목록 조회에 실패했습니다. (resultCd=" + resultCd + ")");
        }
        return body;
    }

    /**
     * 장바구니 항목 삭제 (cartNo + cartDtlNo 단위).
     * 삭제 응답 형식은 미실측이므로 resultCd("0000") / rst("S")를 병행 판별하고,
     * 둘 다 없으면 HTTP 200(정상 JSON 응답)을 성공으로 본다.
     *
     * @return 성공 여부
     */
    public boolean deleteCartItem(TwosomeStoreSessionContext context, String cartNo, String cartDtlNo) {
        // 실측: jQuery 배열 직렬화 형식(cartDtlNo[]=N) + Referer 헤더가 필요. resultCd "00"이 성공
        Map<String, String> params = new LinkedHashMap<>();
        params.put("cartNo", cartNo);
        params.put("cartDtlNo[]", cartDtlNo);

        HttpRequest request = HttpRequest.newBuilder(buildPostForm(CART_DELETE_URL, params),
                        (name, value) -> true)
                .header("Referer", BASE_URL + "/ts/menuCartList.do?cartGbcd=10")
                .build();

        HttpResponse<String> response = send(context, request, "delete cart item");

        JsonNode body = readTree(response.body(), "delete cart item");
        String resultCd = text(body, "resultCd");
        String rst = text(body, "rst");
        if (resultCd != null) {
            return "00".equals(resultCd) || "0000".equals(resultCd);
        }
        if (rst != null) {
            return "S".equals(rst);
        }
        return true;
    }

    /**
     * 장바구니 항목의 퍼스널 옵션(커스텀) 명세 조회 (읽기 전용).
     * 실측 요청: POST {cartNo, cartDtlNo} → fetchResultListSet[{CSTM_NM, PRICE, ...}]
     */
    public JsonNode fetchMenuCustomList(TwosomeStoreSessionContext context, String cartNo, String cartDtlNo) {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("cartNo", cartNo);
        params.put("cartDtlNo", cartDtlNo);

        HttpResponse<String> response = send(context,
                buildPostForm(CART_CUSTOM_LIST_URL, params), "cart custom list");
        return readTree(response.body(), "cart custom list");
    }

    /**
     * 메뉴 상세 페이지 HTML 조회 (옵션 그룹 파싱용). 로그인 세션 + 매장 설정 필요.
     */
    public String fetchMenuDetailHtml(TwosomeStoreSessionContext context, String menuCd, String midCd) {
        String url = MENU_DETAIL_URL + "?menuCd=" + encode(menuCd) + "&midCd=" + encode(midCd);
        HttpResponse<String> response = send(context, buildGet(url), "menu detail");
        return response.body();
    }

    /**
     * 퍼스널 옵션(커스텀) 목록 조회. 변형 메뉴 코드 기준으로 커스텀 패널 HTML 조각을 반환.
     * 실측 요청: POST {menuCd(변형코드), ordAvabYn, storeCd} → dataType html
     *
     * @return 커스텀 패널 HTML 조각 (빈 문자열이면 커스텀 없음)
     */
    public String fetchMenuCustomOptionsHtml(TwosomeStoreSessionContext context, String menuCd,
                                             String storeCd, String ordAvabYn) {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("menuCd", menuCd);
        params.put("ordAvabYn", ordAvabYn != null ? ordAvabYn : "Y");
        params.put("storeCd", storeCd);

        HttpResponse<String> response = send(context,
                buildPostForm(MENU_CUSTOM_OPTIONS_URL, params), "menu custom options");
        return response.body();
    }

    /**
     * 매장 상세 정보 조회. 세션 없이도 동작 (익명 컨텍스트 허용).
     * 실측 응답: {"queryCode":1000,"fetchResultListSet":[{"STORE_NM":"...","ORD_TIME":"07:30 ~ 20:50",
     * "OVERTIME_ORDER_YN":"Y","EASM_PRVT_YN":"Y","OPT_CD_JSON":"[{CD,NM,REF},...]", ...}]}
     */
    public JsonNode fetchStoreDetailInfo(TwosomeStoreSessionContext context, String storeCd,
                                         double lat, double longi) {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("storeCd", storeCd);
        params.put("lat", String.valueOf(lat));
        params.put("longi", String.valueOf(longi));

        HttpResponse<String> response = send(context,
                buildPostForm(STORE_DETAIL_URL, params), "store detail info");

        JsonNode body = readTree(response.body(), "store detail info");
        if (body.path("queryCode").asInt(-1) != 1000) {
            throw new TwosomeStoreException(
                    "매장 상세 조회에 실패했습니다. (queryCode=" + body.path("queryCode").asInt(-1) + ")");
        }
        return body.path("fetchResultListSet");
    }

    /**
     * 선택 옵션 조합의 변형 메뉴 코드 조회.
     * 실측 요청: opts[]=010I&opts[]=020L&menuCd=10100001&storeCd=1102115
     * 실측 응답: {"MENU_CD":"10101018","MENU_NM":"T)ice아메리칸노L","SALE_AMT":"5,300",...}
     *
     * @return 변형 메뉴 정보 JSON
     */
    public JsonNode resolveVariantMenu(TwosomeStoreSessionContext context, String menuCd,
                                       String storeCd, List<String> opts) {
        List<String[]> pairs = new ArrayList<>();
        for (String opt : opts) {
            pairs.add(new String[]{"opts[]", opt});
        }
        pairs.add(new String[]{"menuCd", menuCd});
        pairs.add(new String[]{"storeCd", storeCd});

        HttpResponse<String> response = send(context,
                buildPostFormPairs(RESOLVE_VARIANT_URL, pairs), "resolve variant menu");
        return readTree(response.body(), "resolve variant menu");
    }

    public record CartAddResult(boolean success, String resultCd, String resultMsg) {
    }

    // ==================== 낮은 수준 HTTP 헬퍼 ====================

    private HttpRequest buildGet(String url) {
        return HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(REQUEST_TIMEOUT)
                .header("User-Agent", USER_AGENT)
                .header("X-Requested-With", "XMLHttpRequest")
                .GET()
                .build();
    }

    private HttpRequest buildPostForm(String url, Map<String, String> params) {
        String body = params.entrySet().stream()
                .map(e -> encode(e.getKey()) + "=" + encode(e.getValue()))
                .collect(Collectors.joining("&"));

        return HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(REQUEST_TIMEOUT)
                .header("User-Agent", USER_AGENT)
                .header("X-Requested-With", "XMLHttpRequest")
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();
    }

    /** 배열 키(opts[] 등) 중복 허용 form 요청 빌더 */
    private HttpRequest buildPostFormPairs(String url, List<String[]> pairs) {
        String body = pairs.stream()
                .map(p -> encode(p[0]) + "=" + encode(p[1]))
                .collect(Collectors.joining("&"));

        return HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(REQUEST_TIMEOUT)
                .header("User-Agent", USER_AGENT)
                .header("X-Requested-With", "XMLHttpRequest")
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();
    }

    private static String encode(String value) {
        return URLEncoder.encode(value != null ? value : "", StandardCharsets.UTF_8);
    }

    private HttpResponse<String> send(TwosomeStoreSessionContext context, HttpRequest request, String action) {
        return send(context, request, action, HttpResponse.BodyHandlers.ofString());
    }

    private <T> HttpResponse<T> send(TwosomeStoreSessionContext context, HttpRequest request,
                                     String action, HttpResponse.BodyHandler<T> handler) {
        HttpRequest.Builder requestBuilder = HttpRequest.newBuilder(request, (name, value) -> true);
        String cookieHeader = context.getCookieHeader();
        if (cookieHeader != null) {
            requestBuilder.header("Cookie", cookieHeader);
        }

        HttpResponse<T> response;
        try {
            response = context.getHttpClient().send(requestBuilder.build(), handler);
        } catch (IOException e) {
            throw new TwosomeStoreException("투썸 서버 호출 중 네트워크 오류가 발생했습니다. (" + action + ")", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new TwosomeStoreException("투썸 서버 호출이 중단되었습니다. (" + action + ")", e);
        }

        context.storeCookies(response);

        if (response.statusCode() == 401) {
            throw new TwosomeStoreSessionExpiredException("투썸 세션이 만료되었습니다. (401)");
        }
        if (response.statusCode() != 200) {
            throw new TwosomeStoreException(
                    "투썸 서버가 오류를 반환했습니다. (" + action + ", HTTP " + response.statusCode() + ")");
        }
        return response;
    }

    private JsonNode readTree(String body, String action) {
        try {
            return objectMapper.readTree(body);
        } catch (IOException e) {
            throw new TwosomeStoreException("투썸 응답을 해석하지 못했습니다. (" + action + ")", e);
        }
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value != null && value.isTextual() ? value.asText() : null;
    }
}
