package com.example.coffeeorder.service;

import com.example.coffeeorder.dto.TwosomeMenuOptionsResponse;
import com.example.coffeeorder.dto.TwosomeVariantResolveRequest;
import com.example.coffeeorder.dto.TwosomeVariantResolveResponse;
import com.example.coffeeorder.entity.TwosomeMenu;
import com.example.coffeeorder.exception.TwosomeStoreException;
import com.example.coffeeorder.repository.TwosomeMenuRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 투썸 메뉴 상세 옵션 관리.
 *
 * - 메뉴 상세 페이지(tsTsoMenuDetail.do)를 jsoup으로 파싱해 옵션 그룹을 추출하고
 *   twosome_menu.option_data(JSON)에 캐시한다 (옵션 구성이 변경된 메뉴는 새로고침 시 무효화).
 * - 상세 페이지 조회에는 투썸 세션이 필요하므로 관리자 또는 대표 세션을 사용한다.
 * - 옵션 조합으로 변형 메뉴 코드를 조회한다 (getNewMenuInfoAjax).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TwosomeMenuOptionService {

    /** 투썸 세션에 매장이 바인딩되지 않았을 때 상세 페이지가 돌려주는 스크립트 알림 문구 */
    private static final String NO_STORE_ALERT = "주문가능한 매장이 없습니다";
    private static final Duration CUSTOM_OPTIONS_CACHE_TTL = Duration.ofHours(1);

    private final TwosomeMenuRepository twosomeMenuRepository;
    private final TwosomeStoreIntegrationService integrationService;
    private final ObjectMapper objectMapper;
    private final Map<String, CachedCustomOptions> customOptionsCache = new ConcurrentHashMap<>();

    /**
     * 메뉴 옵션 그룹 조회 (캐시 우선). 상세 페이지 파싱 결과가 없으면 조회 후 캐시한다.
     *
     * @param sessionKey 옵션 조회에 사용할 세션 (관리자 "active" 또는 대표 "rep:{memberId}")
     */
    public TwosomeMenuOptionsResponse getMenuOptions(String sessionKey, String menuCd) {
        return getMenuOptions(sessionKey, menuCd, null);
    }

    public TwosomeMenuOptionsResponse getMenuOptions(String sessionKey, String menuCd, String midCd) {
        TwosomeMenu menu = (midCd != null && !midCd.isBlank()
                ? twosomeMenuRepository.findByMenuCdAndMidCd(menuCd, midCd)
                : twosomeMenuRepository.findFirstByMenuCdOrderByIdAsc(menuCd))
                .orElseThrow(() -> new TwosomeStoreException("메뉴를 찾을 수 없습니다. (menuCd=" + menuCd + ")"));

        if (menu.getOptionData() != null && !menu.getOptionData().isBlank()) {
            try {
                return objectMapper.readValue(menu.getOptionData(), TwosomeMenuOptionsResponse.class);
            } catch (Exception e) {
                log.warn("Cached option data is broken, re-fetching (menuCd={}): {}", menuCd, e.getMessage());
            }
        }

        if (menu.getMidCd() == null || menu.getMidCd().isBlank()) {
            throw new TwosomeStoreException("메뉴의 중분류 코드가 없어 옵션을 조회할 수 없습니다. (menuCd=" + menuCd + ")");
        }

        String html = integrationService.fetchMenuDetailHtml(sessionKey, menuCd, menu.getMidCd());
        TwosomeMenuOptionsResponse parsed = parseDetailHtml(menuCd, html);

        // 캐시 저장 (파싱 성공 시에만)
        if (parsed.isParsed()) {
            try {
                menu.setOptionData(objectMapper.writeValueAsString(parsed));
                twosomeMenuRepository.save(menu);
            } catch (Exception e) {
                log.warn("Failed to cache option data (menuCd={}): {}", menuCd, e.getMessage());
            }
        }
        return parsed;
    }

    /**
     * 퍼스널 옵션(커스텀) 조회: 변형 코드 기반 패널 HTML을 파싱해 구조화된 JSON으로 반환.
     * 커스텀 없는 메뉴는 hasCustom=false.
     *
     * 실측 마크업(tsTsoMenuCustomListAjax HTML 조각):
     * - 수량형: input[id^=spinner_box_qty] (data-data=key, data-price=단가) + hidden #cstmInfo{key} (그룹-추가유형-추가코드-조정유형-조정코드)
     * - 선택형: input:radio[name^=radio_custom] (data-price, #chgYn 조정여부) + label 텍스트 + hidden #cstmInfo{id}
     * - 추가형: check_custom 체크박스를 선택하면 하위 라디오가 열리고, 단일 항목 또는 '보통'이 기본 선택됨
     * - article.collapse의 이름과 data-id를 카테고리로 유지하고, 우유 그룹(3004)은 하나만 선택
     */
    public JsonNode getMenuCustomOptions(String sessionKey, String variantMenuCd) {
        CachedCustomOptions cached = customOptionsCache.get(variantMenuCd);
        if (cached != null && cached.expiresAt().isAfter(Instant.now())) {
            return cached.value();
        }
        String html = integrationService.getMenuCustomOptionsHtml(sessionKey, variantMenuCd);
        JsonNode parsed = parseCustomPanelHtml(variantMenuCd, html);
        customOptionsCache.put(variantMenuCd,
                new CachedCustomOptions(Instant.now().plus(CUSTOM_OPTIONS_CACHE_TTL), parsed));
        return parsed;
    }

    public void clearCustomOptionsCache() {
        customOptionsCache.clear();
    }

    private record CachedCustomOptions(Instant expiresAt, JsonNode value) {
    }

    JsonNode parseCustomPanelHtml(String variantMenuCd, String html) {
        ObjectNode result = objectMapper.createObjectNode();
        result.put("menuCd", variantMenuCd);
        if (html == null || html.isBlank()) {
            result.put("hasCustom", false);
            result.set("qtyItems", objectMapper.createArrayNode());
            result.set("choiceGroups", objectMapper.createArrayNode());
            result.set("categories", objectMapper.createArrayNode());
            return result;
        }

        Document doc = Jsoup.parse(html);

        ArrayNode qtyItems = objectMapper.createArrayNode();
        for (Element input : doc.select("input[type=number][id^=spinner_box_qty]")) {
            String key = input.attr("data-data");
            String tuple = hiddenValue(doc, "cstmInfo" + key);
            ObjectNode item = objectMapper.createObjectNode();
            item.put("key", key);
            item.put("name", input.attr("data-id"));
            item.put("unitPrice", parseIntOrZero(input.attr("data-price")));
            item.put("maxQty", maxQtyForGroup(tuple));
            item.put("deposit", parseIntOrZero(hiddenValue(doc, "deposit" + key)));
            putTupleFields(item, tuple);
            putCategoryFields(item, input);
            qtyItems.add(item);
        }

        ArrayNode choiceGroups = objectMapper.createArrayNode();
        Map<String, ObjectNode> groupByName = new LinkedHashMap<>();
        for (Element radio : doc.select("input[type=radio][name^=radio_custom]")) {
            String groupName = radio.attr("name");
            String groupKey = groupName.replace("radio_custom", "");
            ObjectNode group = groupByName.computeIfAbsent(groupName, name -> {
                ObjectNode g = objectMapper.createObjectNode();
                g.put("groupKey", groupKey);
                g.put("name", resolveGroupTitle(radio));
                g.put("toggleable", doc.selectFirst(
                        "input[type=checkbox][data-data=\"" + groupKey + "\"]") != null);
                if (groupKey.startsWith("3004-")) {
                    g.put("exclusiveGroupKey", "3004");
                }
                Element item = radio.closest("div.items");
                Element price = item != null ? item.selectFirst(".selected_value .data-custom-price2") : null;
                g.put("displayPrice", price != null ? parseIntOrZero(price.text()) : 0);
                putCategoryFields(g, radio);
                g.set("choices", objectMapper.createArrayNode());
                return g;
            });
            String id = radio.attr("id");
            String rawId = id.startsWith("radio_custom") ? id.substring("radio_custom".length()) : id;
            String tuple = hiddenValue(doc, "cstmInfo" + rawId);
            ObjectNode choice = objectMapper.createObjectNode();
            choice.put("choiceKey", rawId);
            Element label = doc.selectFirst("label[for=" + id + "]");
            choice.put("label", label != null ? label.text().trim() : radio.attr("data-id"));
            choice.put("price", parseIntOrZero(radio.attr("data-price")));
            choice.put("chgYn", hiddenValue(doc, "chgYn" + rawId));
            choice.put("deposit", parseIntOrZero(hiddenValue(doc, "deposit" + rawId)));
            putTupleFields(choice, tuple);
            ((ArrayNode) group.get("choices")).add(choice);
        }
        for (ObjectNode group : groupByName.values()) {
            if (group.path("toggleable").asBoolean()) {
                ArrayNode choices = (ArrayNode) group.get("choices");
                if (choices.size() == 1) {
                    group.put("defaultChoiceKey", choices.get(0).path("choiceKey").asText());
                } else {
                    for (JsonNode choice : choices) {
                        if (choice.path("label").asText().contains("보통")) {
                            group.put("defaultChoiceKey", choice.path("choiceKey").asText());
                            break;
                        }
                    }
                }
            }
            choiceGroups.add(group);
        }

        Map<String, ObjectNode> categoryByKey = new LinkedHashMap<>();
        qtyItems.forEach(item -> addToCategory(categoryByKey, (ObjectNode) item, "qtyItems"));
        choiceGroups.forEach(group -> addToCategory(categoryByKey, (ObjectNode) group, "choiceGroups"));
        ArrayNode categories = objectMapper.createArrayNode();
        categoryByKey.values().forEach(categories::add);

        result.put("hasCustom", qtyItems.size() > 0 || choiceGroups.size() > 0);
        result.set("qtyItems", qtyItems);
        result.set("choiceGroups", choiceGroups);
        result.set("categories", categories);
        return result;
    }

    private String resolveGroupTitle(Element radio) {
        Element item = radio.closest("div.items");
        Element label = item != null ? item.selectFirst("h3 .label") : null;
        if (label != null && !label.text().isBlank()) {
            return label.text().trim();
        }
        return radio.attr("name");
    }

    private static void putCategoryFields(ObjectNode node, Element element) {
        Element article = element.closest("article.collapse");
        String categoryKey = "custom";
        String categoryName = "퍼스널 옵션";
        if (article != null) {
            Element header = article.selectFirst(".collapse-header [data-action=collapse]");
            Element name = article.selectFirst(".collapse-header .name");
            if (header != null && !header.attr("data-id").isBlank()) {
                categoryKey = header.attr("data-id");
            }
            if (name != null && !name.text().isBlank()) {
                categoryName = name.text().trim();
            }
        }
        node.put("categoryKey", categoryKey);
        node.put("categoryName", categoryName);
    }

    private void addToCategory(Map<String, ObjectNode> categories, ObjectNode item, String itemType) {
        String key = item.path("categoryKey").asText("custom");
        ObjectNode category = categories.computeIfAbsent(key, categoryKey -> {
            ObjectNode created = objectMapper.createObjectNode();
            created.put("categoryKey", categoryKey);
            created.put("categoryName", item.path("categoryName").asText("퍼스널 옵션"));
            created.set("qtyItems", objectMapper.createArrayNode());
            created.set("choiceGroups", objectMapper.createArrayNode());
            return created;
        });
        ((ArrayNode) category.get(itemType)).add(item);
    }

    /** hidden input 값 조회 */
    private static String hiddenValue(Document doc, String id) {
        Element el = doc.selectFirst("#" + id);
        return el != null ? el.attr("value") : "";
    }

    /** cstmInfo 5트플(그룹-추가유형-추가코드-조정유형-조정코드)을 필드로 분해 */
    private static void putTupleFields(ObjectNode node, String tuple) {
        String[] parts = (tuple != null ? tuple : "").split("-", -1);
        node.put("grpCd", part(parts, 0));
        node.put("typeAddCd", part(parts, 1));
        node.put("cstmAddCd", part(parts, 2));
        node.put("typeChgCd", part(parts, 3));
        node.put("cstmChgCd", part(parts, 4));
    }

    private static String part(String[] parts, int idx) {
        return parts.length > idx ? parts[idx] : "";
    }

    /**
     * 수량형 최대 수량 — 투썸 공식 클라이언트 JS 규칙 (store-page.html fn_cstmBtnClick)
     * 9008 숫자초 3 / 9009 캡초 9 / 9012 홀케익포크 15 / 9013 조각케익포크 12 /
     * 9501~9505 토핑 1 / 9018 얼음컵제공 1 / 9003 버블 1 / 그 외 2
     */
    private static int maxQtyForGroup(String tuple) {
        String grpCd = tuple != null && tuple.contains("-") ? tuple.split("-", -1)[0] : "";
        return switch (grpCd) {
            case "9008" -> 3;
            case "9009" -> 9;
            case "9012" -> 15;
            case "9013" -> 12;
            case "9501", "9502", "9503", "9504", "9505", "9018", "9003" -> 1;
            default -> 2;
        };
    }

    private static int parseIntOrZero(String value) {
        try {
            return Integer.parseInt((value != null ? value : "").replace(",", "").trim());
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    /**
     * 선택 옵션 조합의 변형 메뉴 코드 조회
     */
    public TwosomeVariantResolveResponse resolveVariant(String sessionKey, TwosomeVariantResolveRequest request) {
        if (request.getOpts() == null || request.getOpts().isEmpty()) {
            throw new TwosomeStoreException("선택된 옵션이 없습니다.");
        }
        JsonNode body = integrationService.resolveVariantMenu(sessionKey, request.getMenuCd(), request.getOpts());
        String variantMenuCd = textOf(body, "MENU_CD");
        if (variantMenuCd == null || variantMenuCd.isBlank()) {
            throw new TwosomeStoreException("변형 메뉴 코드를 조회하지 못했습니다.");
        }
        return new TwosomeVariantResolveResponse(
                variantMenuCd,
                textOf(body, "MENU_NM"),
                parsePrice(textOf(body, "SALE_AMT")),
                textOf(body, "UP_MENU_NM"));
    }

    /**
     * 메뉴 상세 HTML 파싱.
     *
     * 실측 구조 (raw HTML):
     * - 라디오 input은 JS가 동적으로 생성하므로 원본 HTML에는 없다.
     * - 대신 히든 #optList에 전체 옵션 메타가 Java-map 문자열로 존재한다:
     *   [{MENU_CD=..., OPT_GRP_NM=온도, OPTS=010H, OPT_NM=핫, OPT_GRP_CD=010,
     *     BASIC_DISPLAY_YN=Y, OPT_FIRST_YN=Y, DISPLAY_NO=1}, ...]
     * - 사이트 기본 선택 규칙: BASIC_DISPLAY_YN=Y인 옵션을 미선택하지만,
     *   컵 선택 그룹(05x)만은 예외로 아무것도 체크하지 않아 사용자 선택이 필수다.
     *
     * JS가 실행된 캡처(라디오가 이미 렌더된 HTML)도 파싱할 수 있도록 라디오 기반
     * 파싱을 2순위 폭백으로 둔다.
     */
    TwosomeMenuOptionsResponse parseDetailHtml(String menuCd, String html) {
        if (html == null || html.isBlank()) {
            return unparsed(menuCd, "메뉴 상세 페이지 응답이 비어 있습니다.");
        }
        // 투썸 세션에 매장이 바인딩되지 않으면 상세 페이지 대신 JS 알림 스크립트가 날아온다.
        // 이를 "옵션 없음"으로 파싱해 캐시하면 복구 전까지 메뉴를 쓸 수 없으므로 반드시 배제한다.
        if (html.contains(NO_STORE_ALERT)) {
            return unparsed(menuCd, "투썸 세션에 매장이 설정되지 않아 메뉴 상세를 조회하지 못했습니다.");
        }

        Document doc = Jsoup.parse(html);

        // 1순위: #optList 히든 입력값 (실서비스 raw HTML 경로)
        List<OptMeta> metas = parseOptList(doc);
        if (!metas.isEmpty()) {
            return buildFromOptList(menuCd, metas);
        }

        // 2순위: 이미 라디오가 렌더된 HTML (JS 실행 캡처 등)
        return parseRenderedRadios(menuCd, doc, metas);
    }

    /**
     * #optList 메타로 옵션 그룹을 구성한다 (문서 순서 유지).
     * 컵 선택 그룹(그룹코드 05x 또는 이름에 '컵')은 사이트에서 기본 선택을 두지
     * 않으므로 default 없이 required로 표시한다.
     */
    private TwosomeMenuOptionsResponse buildFromOptList(String menuCd, List<OptMeta> metas) {
        Map<String, TwosomeMenuOptionsResponse.OptionGroup> groups = new LinkedHashMap<>();
        for (OptMeta meta : metas) {
            if (meta.opts == null || meta.opts.isBlank() || meta.grpCd == null) {
                continue;
            }
            TwosomeMenuOptionsResponse.OptionGroup group = groups.computeIfAbsent(meta.grpCd, k -> {
                TwosomeMenuOptionsResponse.OptionGroup g = new TwosomeMenuOptionsResponse.OptionGroup();
                g.setGrpCd(meta.grpCd);
                g.setGrpNm(meta.grpNm != null && !meta.grpNm.isBlank() ? meta.grpNm : meta.grpCd);
                g.setOptions(new ArrayList<>());
                return g;
            });
            boolean isDefault = "Y".equals(meta.basicYn) && !isCupSelectionGroup(meta.grpCd, meta.grpNm);
            group.getOptions().add(new TwosomeMenuOptionsResponse.Option(meta.opts, meta.optNm, isDefault));
        }

        for (TwosomeMenuOptionsResponse.OptionGroup group : groups.values()) {
            boolean hasDefault = group.getOptions().stream()
                    .anyMatch(TwosomeMenuOptionsResponse.Option::isDefaultOpt);
            group.setRequired(!hasDefault);
        }

        TwosomeMenuOptionsResponse response = new TwosomeMenuOptionsResponse();
        response.setMenuCd(menuCd);
        response.setParsed(true);
        response.setMessage(null);
        response.setGroups(new ArrayList<>(groups.values()));
        return response;
    }

    private boolean isCupSelectionGroup(String grpCd, String grpNm) {
        return (grpCd != null && grpCd.startsWith("05"))
                || (grpNm != null && grpNm.contains("컵"));
    }

    /**
     * 라디오가 이미 렌더된 HTML용 폭백 파싱.
     * 그룹 내 checked 라디오가 없으면 required (예: 컵 선택).
     */
    private TwosomeMenuOptionsResponse parseRenderedRadios(String menuCd, Document doc, List<OptMeta> metas) {
        Map<String, OptMeta> metaByOpts = new LinkedHashMap<>();
        for (OptMeta m : metas) {
            metaByOpts.put(m.opts, m);
        }

        Elements radios = doc.select("input[type=radio][name^=radio_group]");
        if (radios.isEmpty()) {
            // 옵션 그룹이 없는 메뉴: 빈 그룹으로 정상 처리
            TwosomeMenuOptionsResponse response = new TwosomeMenuOptionsResponse();
            response.setMenuCd(menuCd);
            response.setParsed(true);
            response.setMessage("옵션이 없는 메뉴입니다.");
            response.setGroups(new ArrayList<>());
            return response;
        }

        // 그룹별 라디오 수집 (문서 순서 유지)
        Map<String, List<Element>> radiosByGroup = new LinkedHashMap<>();
        for (Element radio : radios) {
            String groupName = radio.attr("name"); // radio_group010
            radiosByGroup.computeIfAbsent(groupName, k -> new ArrayList<>()).add(radio);
        }

        List<TwosomeMenuOptionsResponse.OptionGroup> groups = new ArrayList<>();
        try {
            for (Map.Entry<String, List<Element>> entry : radiosByGroup.entrySet()) {
                String grpCd = entry.getKey().replace("radio_group", "");
                List<TwosomeMenuOptionsResponse.Option> options = new ArrayList<>();

                for (Element radio : entry.getValue()) {
                    String id = radio.attr("id"); // radio_group010H
                    String opts = id.replace("radio_group", "");
                    String optNm = radio.hasAttr("data-id") ? radio.attr("data-id") : optNameFromMeta(metaByOpts, opts);
                    boolean checked = radio.hasAttr("checked");
                    options.add(new TwosomeMenuOptionsResponse.Option(opts, optNm, checked));
                }

                TwosomeMenuOptionsResponse.OptionGroup group = new TwosomeMenuOptionsResponse.OptionGroup();
                group.setGrpCd(grpCd);
                group.setGrpNm(groupNameFromMeta(metaByOpts, grpCd, entry.getKey()));
                boolean hasDefault = options.stream().anyMatch(TwosomeMenuOptionsResponse.Option::isDefaultOpt);
                group.setRequired(!hasDefault);
                group.setOptions(options);
                groups.add(group);
            }
        } catch (Exception e) {
            log.warn("Failed to parse option detail page (menuCd={}): {}", menuCd, e.getMessage());
            return unparsed(menuCd, "옵션 정보 파싱에 실패했습니다. (" + e.getMessage() + ")");
        }

        TwosomeMenuOptionsResponse response = new TwosomeMenuOptionsResponse();
        response.setMenuCd(menuCd);
        response.setParsed(true);
        response.setMessage(null);
        response.setGroups(groups);
        return response;
    }

    /** #optList 히든 입력값 파싱 → 문서 순서의 OptMeta 목록 */
    private List<OptMeta> parseOptList(Document doc) {
        List<OptMeta> result = new ArrayList<>();
        Element optList = doc.selectFirst("#optList");
        if (optList == null) {
            return result;
        }
        String value = optList.attr("value");
        if (value == null || value.isBlank()) {
            return result;
        }
        // [{K=V, K=V, ...}, {...}] 형태
        int idx = 0;
        while (idx < value.length()) {
            int open = value.indexOf('{', idx);
            if (open < 0) break;
            int close = value.indexOf('}', open);
            if (close < 0) break;
            String body = value.substring(open + 1, close);
            Map<String, String> kv = new LinkedHashMap<>();
            for (String pair : body.split(", ")) {
                int eq = pair.indexOf('=');
                if (eq > 0) {
                    kv.put(pair.substring(0, eq).trim(), pair.substring(eq + 1).trim());
                }
            }
            String opts = kv.get("OPTS");
            if (opts != null) {
                OptMeta meta = new OptMeta();
                meta.opts = opts;
                meta.grpCd = kv.get("OPT_GRP_CD");
                meta.grpNm = kv.get("OPT_GRP_NM");
                meta.optNm = kv.get("OPT_NM");
                meta.basicYn = kv.get("BASIC_DISPLAY_YN");
                result.add(meta);
            }
            idx = close + 1;
        }
        return result;
    }

    private String optNameFromMeta(Map<String, OptMeta> metaByOpts, String opts) {
        OptMeta meta = metaByOpts.get(opts);
        return meta != null ? meta.optNm : null;
    }

    private String groupNameFromMeta(Map<String, OptMeta> metaByOpts, String grpCd, String fallback) {
        for (OptMeta meta : metaByOpts.values()) {
            if (grpCd.equals(meta.grpCd) && meta.grpNm != null) {
                return meta.grpNm;
            }
        }
        return fallback;
    }

    private TwosomeMenuOptionsResponse unparsed(String menuCd, String message) {
        TwosomeMenuOptionsResponse response = new TwosomeMenuOptionsResponse();
        response.setMenuCd(menuCd);
        response.setParsed(false);
        response.setMessage(message);
        response.setGroups(new ArrayList<>());
        return response;
    }

    private static Integer parsePrice(String saleAmt) {
        if (saleAmt == null) return null;
        try {
            return Integer.parseInt(saleAmt.replace(",", "").trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String textOf(JsonNode node, String fieldName) {
        JsonNode value = node.get(fieldName);
        return (value != null && value.isTextual()) ? value.asText() : null;
    }

    private static class OptMeta {
        String opts;
        String grpCd;
        String grpNm;
        String optNm;
        String basicYn;
    }
}
