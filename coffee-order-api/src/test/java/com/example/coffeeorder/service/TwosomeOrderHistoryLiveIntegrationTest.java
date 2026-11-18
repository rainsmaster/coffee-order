package com.example.coffeeorder.service;

import com.example.coffeeorder.dto.TwosomeOrderHistory;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@TestPropertySource(properties = {
        "twosome.keepalive.enabled=false",
        "twosome.menu-refresh.enabled=false",
        "spring.jpa.show-sql=false"
})
@EnabledIfSystemProperty(named = "twosome.live.order-history", matches = "true")
class TwosomeOrderHistoryLiveIntegrationTest {

    @Autowired
    private TwosomeStoreIntegrationService integrationService;

    @Autowired
    private TwosomeOrderHistoryParser parser;

    @Test
    void readsActualOrderDetailCustomOptionsAndReceiptWithoutWritingOrderData() {
        String sessionKey = System.getProperty("twosome.live.session-key", "active");
        LocalDate today = LocalDate.now();
        JsonNode body;
        try {
            body = integrationService.getOrderHistory(sessionKey,
                    today.minusDays(31).format(DateTimeFormatter.BASIC_ISO_DATE),
                    today.plusDays(1).format(DateTimeFormatter.BASIC_ISO_DATE), 1);
        } catch (com.example.coffeeorder.exception.TwosomeStoreSessionExpiredException e) {
            org.junit.jupiter.api.Assumptions.assumeTrue(false,
                    "유효한 투썸 세션이 없어 실제 주문 조회는 실행하지 않았습니다.");
            return;
        }
        List<TwosomeOrderHistory.Summary> summaries = parser.parseList(body);
        org.junit.jupiter.api.Assumptions.assumeTrue(!summaries.isEmpty(),
                "선택한 계정에 최근 주문이 없어 상세 검증을 실행하지 않았습니다.");
        TwosomeOrderHistory.Summary summary = summaries.stream()
                .filter(candidate -> "CJENM커머스부문점".equals(candidate.storeNm()))
                .findFirst()
                .orElse(summaries.get(0));

        String html = integrationService.getOrderDetailHtml(sessionKey, summary.ordNo());
        TwosomeOrderHistory.Detail detail = parser.parseDetail(html, summary);
        assertThat(detail.summary().ordNo()).isEqualTo(summary.ordNo());
        assertThat(detail.simpleOrderNo()).isNotBlank();
        assertThat(detail.itemsComplete()).isTrue();

        TwosomeOrderHistory.Item firstItem = detail.items().get(0);
        JsonNode customBody = integrationService.getOrderCustomList(
                sessionKey, summary.ordNo(), firstItem.ordDtlNo());
        List<TwosomeOrderHistory.CustomOption> customOptions = parser.parseCustomOptions(customBody);
        assertThat(customOptions).isNotNull();

        if (detail.receiptNo() != null && !detail.receiptNo().isBlank()
                && !"80".equals(detail.summary().statusCode())) {
            String receiptHtml = integrationService.getReceiptHtml(sessionKey, detail.receiptNo());
            String custNo = parser.extractReceiptCustNo(receiptHtml);
            JsonNode receiptBody = integrationService.getReceiptData(sessionKey, detail.receiptNo(), custNo);
            TwosomeOrderHistory.Receipt receipt = parser.parseReceipt(detail.receiptNo(), receiptBody);
            assertThat(receipt.simpleOrderNo()).isEqualTo(detail.simpleOrderNo());
            assertThat(receipt.approvalNo()).isNotBlank();
            assertThat(receipt.approvedAt()).isNotNull();
        }
    }
}
