package com.example.coffeeorder.service;

import com.example.coffeeorder.dto.TwosomeOrderHistory;
import com.example.coffeeorder.exception.TwosomeStoreException;
import com.fasterxml.jackson.databind.JsonNode;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class TwosomeOrderHistoryParser {

    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final DateTimeFormatter MINUTE_DATE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    private static final Pattern STATUS_CODE = Pattern.compile("ordStatGbcdChk\\s*=\\s*\\\"(\\d+)\\\"");
    private static final Pattern POS_SALE_NO = Pattern.compile("posAccSaleNo\\s*=\\s*'([^']*)'");
    private static final Pattern RECEIPT_NO = Pattern.compile("fn_receipt\\('([^']+)'\\)");
    private static final Pattern CUST_NO = Pattern.compile("var\\s+custNo\\s*=\\s*\\\"([^\\\"]+)\\\"");
    private static final Pattern UNIT_PRICE = Pattern.compile("상품금액\\s*([\\d,]+)원");
    private static final Pattern LINE_PRICE = Pattern.compile("수량/주문금액\\s*\\d+개\\s*/\\s*([\\d,]+)원");
    private static final Pattern RECEIPT_FIELD = Pattern.compile("^\\[([^]]+)]\\s*(.*)$");

    public List<TwosomeOrderHistory.Summary> parseList(JsonNode body) {
        if (body == null || body.path("queryCode").asInt(-1) != 1000) {
            throw new TwosomeStoreException("주문내역 응답을 확인하지 못했습니다.");
        }
        List<TwosomeOrderHistory.Summary> result = new ArrayList<>();
        JsonNode rows = body.path("fetchResultListSet");
        if (!rows.isArray()) {
            throw new TwosomeStoreException("주문내역 목록 형식이 변경되어 확인이 필요합니다.");
        }
        for (JsonNode row : rows) {
            String ordNo = text(row, "ORD_NO");
            if (ordNo == null || ordNo.isBlank()) {
                throw new TwosomeStoreException("주문번호가 없는 주문내역이 있습니다.");
            }
            result.add(new TwosomeOrderHistory.Summary(
                    ordNo,
                    text(row, "STORE_NM"),
                    text(row, "ORD_STAT_GBCD"),
                    text(row, "ORD_STAT_GBNM"),
                    parseDate(text(row, "ORD_DTIME")),
                    parseDate(text(row, "MD_PICU_DTIME")),
                    text(row, "ORD_GBCD"),
                    text(row, "UP_MENU_NM"),
                    text(row, "MENU_IMG_03")));
        }
        return result;
    }

    public TwosomeOrderHistory.Detail parseDetail(String html, TwosomeOrderHistory.Summary summary) {
        if (html == null || html.isBlank()) {
            throw new TwosomeStoreException("주문상세 응답이 비어 있습니다.");
        }
        Document document = Jsoup.parse(html);
        String ordNo = summary.ordNo();
        String simpleOrderNo = value(document, "#simpOrdNo");
        if (simpleOrderNo == null) {
            Element number = document.selectFirst(".ts24_twosome_order_no em");
            simpleOrderNo = number != null ? normalized(number.text()) : null;
        }

        List<TwosomeOrderHistory.Step> steps = new ArrayList<>();
        String currentStep = null;
        String lastEndedStep = null;
        for (Element step : document.select(".progress_group .step")) {
            Element text = step.selectFirst(".step_text");
            if (text == null) {
                continue;
            }
            String name = normalized(text.text());
            String state = step.hasClass("now") ? "CURRENT" : step.hasClass("ended") ? "ENDED" : "PENDING";
            steps.add(new TwosomeOrderHistory.Step(name, state));
            if ("CURRENT".equals(state)) {
                currentStep = name;
            }
            if ("ENDED".equals(state)) {
                lastEndedStep = name;
            }
        }
        if (currentStep == null) {
            currentStep = lastEndedStep;
        }

        Map<String, Integer> paymentAmounts = new LinkedHashMap<>();
        for (Element item : document.select(".item")) {
            Element labelElement = item.selectFirst(".label");
            if (labelElement == null) {
                continue;
            }
            String label = normalized(labelElement.text());
            String value = normalized(item.text());
            if (value.startsWith(label)) {
                value = normalized(value.substring(label.length()));
            }
            Integer amount = parseMoney(value);
            if (label != null && amount != null) {
                paymentAmounts.putIfAbsent(label, amount);
            }
        }

        List<TwosomeOrderHistory.Item> items = new ArrayList<>();
        boolean itemsComplete = true;
        for (Element element : document.select(".product_list .list_item")) {
            Element menuInput = element.selectFirst("input[id^=menuCd_]");
            Element quantityInput = element.selectFirst("input[id^=menuOrdCnt_]");
            String menuCd = menuInput != null ? menuInput.attr("value") : null;
            String ordDtlNo = null;
            if (menuInput != null) {
                String prefix = "menuCd_" + ordNo;
                String id = menuInput.id();
                if (id.startsWith(prefix)) {
                    ordDtlNo = id.substring(prefix.length());
                }
            }
            int quantity = parsePositiveInt(quantityInput != null ? quantityInput.attr("value") : null);
            String itemText = normalized(element.text());
            Element name = element.selectFirst(".list_item_header .name em");
            Element option = element.selectFirst(".option_group");
            items.add(new TwosomeOrderHistory.Item(
                    ordDtlNo,
                    menuCd,
                    name != null ? normalized(name.text()) : null,
                    option != null ? normalized(option.text()) : null,
                    quantity,
                    matchMoney(UNIT_PRICE, itemText),
                    matchMoney(LINE_PRICE, itemText),
                    List.of()));
            itemsComplete &= ordDtlNo != null && !ordDtlNo.isBlank()
                    && menuCd != null && !menuCd.isBlank() && quantity > 0;
        }
        itemsComplete &= !items.isEmpty();

        String statusCode = firstMatch(STATUS_CODE, html);
        TwosomeOrderHistory.Summary mergedSummary = statusCode == null || statusCode.equals(summary.statusCode())
                ? summary
                : new TwosomeOrderHistory.Summary(summary.ordNo(), summary.storeNm(), statusCode,
                        summary.statusName(), summary.orderedAt(), summary.pickupAt(), summary.orderTypeCode(),
                        summary.menuName(), summary.menuImage());
        Element message = document.selectFirst(".message_box .message");
        return new TwosomeOrderHistory.Detail(
                mergedSummary,
                simpleOrderNo,
                text(document, ".pick_info_group .address"),
                currentStep,
                List.copyOf(steps),
                paymentAmounts.get("총 주문금액"),
                paymentAmounts.get("할인"),
                paymentAmounts.get("최종 결제금액"),
                Map.copyOf(paymentAmounts),
                firstMatch(POS_SALE_NO, html),
                firstMatch(RECEIPT_NO, html),
                message != null ? normalized(message.text()) : null,
                List.copyOf(items),
                itemsComplete);
    }

    public List<TwosomeOrderHistory.CustomOption> parseCustomOptions(JsonNode body) {
        if (body == null) {
            throw new TwosomeStoreException("퍼스널 옵션 응답이 비어 있습니다.");
        }
        if (body.isObject() && body.has("queryCode") && body.path("queryCode").asInt(-1) != 1000) {
            throw new TwosomeStoreException("퍼스널 옵션 조회를 투썸 서버가 거부했습니다.");
        }
        JsonNode rows = body.isArray() ? body : body.path("fetchResultListSet");
        if (!rows.isArray()) {
            throw new TwosomeStoreException("주문 퍼스널 옵션 형식이 변경되어 확인이 필요합니다.");
        }
        List<TwosomeOrderHistory.CustomOption> options = new ArrayList<>();
        for (JsonNode row : rows) {
            int quantity = parsePositiveInt(text(row, "CSTM_ORD_CNT"));
            String groupCode = text(row, "CSTM_GRP_CD");
            String typeAddCode = nullToEmpty(text(row, "TYPE_ADD_CD"));
            String customAddCode = nullToEmpty(text(row, "CSTM_ADD_CD"));
            String typeChangeCode = nullToEmpty(text(row, "TYPE_CHG_CD"));
            String customChangeCode = nullToEmpty(text(row, "CSTM_CHG_CD"));
            boolean addComplete = !typeAddCode.isEmpty() && !customAddCode.isEmpty();
            boolean changeComplete = !typeChangeCode.isEmpty() && !customChangeCode.isEmpty();
            boolean addPartial = !typeAddCode.isEmpty() != !customAddCode.isEmpty();
            boolean changePartial = !typeChangeCode.isEmpty() != !customChangeCode.isEmpty();
            if (quantity <= 0 || groupCode == null || groupCode.isBlank()
                    || (!addComplete && !changeComplete) || addPartial || changePartial) {
                throw new TwosomeStoreException("퍼스널 옵션의 코드·수량이 불완전해 자동 연결하지 않습니다.");
            }
            options.add(new TwosomeOrderHistory.CustomOption(
                    text(row, "CSTM_NM"),
                    groupCode,
                    typeAddCode,
                    customAddCode,
                    typeChangeCode,
                    customChangeCode,
                    quantity));
        }
        return List.copyOf(options);
    }

    public String extractReceiptCustNo(String receiptHtml) {
        String custNo = firstMatch(CUST_NO, receiptHtml != null ? receiptHtml : "");
        if (custNo == null || custNo.isBlank()) {
            throw new TwosomeStoreException("전자영수증 조회 정보를 확인하지 못했습니다.");
        }
        return custNo;
    }

    public TwosomeOrderHistory.Receipt parseReceipt(String receiptNo, JsonNode body) {
        if (body == null || !"0000".equals(text(body, "RESULT_CODE")) || !body.path("receiptData").isArray()) {
            throw new TwosomeStoreException("전자영수증 응답을 확인하지 못했습니다.");
        }
        Map<String, String> fields = new LinkedHashMap<>();
        for (JsonNode row : body.path("receiptData")) {
            String contents = text(row, "CONTENTS");
            if (contents == null) {
                continue;
            }
            Matcher matcher = RECEIPT_FIELD.matcher(contents.trim());
            if (matcher.matches()) {
                fields.putIfAbsent(matcher.group(1), matcher.group(2).trim());
            }
        }
        return new TwosomeOrderHistory.Receipt(
                receiptNo,
                fields.get("주문번호"),
                parseMoney(fields.get("결제금액")),
                fields.get("승인번호"),
                parseDate(fields.get("승인일시")));
    }

    private static String value(Document document, String selector) {
        Element element = document.selectFirst(selector);
        return element != null ? normalized(element.attr("value")) : null;
    }

    private static String text(Document document, String selector) {
        Element element = document.selectFirst(selector);
        return element != null ? normalized(element.text()) : null;
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        if (value == null || value.isNull() || value.isContainerNode()) {
            return null;
        }
        return normalized(value.asText());
    }

    private static String normalized(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.replaceAll("\\s+", " ").trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private static String nullToEmpty(String value) {
        return value != null ? value : "";
    }

    private static LocalDateTime parseDate(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.replaceAll("\\([^)]*\\)", "").trim();
        try {
            return LocalDateTime.parse(normalized, normalized.length() == 16 ? MINUTE_DATE_TIME : DATE_TIME);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private static int parsePositiveInt(String value) {
        if (value == null) {
            return 0;
        }
        try {
            return Integer.parseInt(value.trim());
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private static Integer parseMoney(String value) {
        if (value == null) {
            return null;
        }
        Matcher matcher = Pattern.compile("([\\d,]+)\\s*원?").matcher(value);
        if (!matcher.find()) {
            return null;
        }
        try {
            return Integer.parseInt(matcher.group(1).replace(",", ""));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static Integer matchMoney(Pattern pattern, String value) {
        Matcher matcher = pattern.matcher(value != null ? value : "");
        return matcher.find() ? parseMoney(matcher.group(1)) : null;
    }

    private static String firstMatch(Pattern pattern, String value) {
        Matcher matcher = pattern.matcher(value);
        return matcher.find() ? matcher.group(1) : null;
    }
}
