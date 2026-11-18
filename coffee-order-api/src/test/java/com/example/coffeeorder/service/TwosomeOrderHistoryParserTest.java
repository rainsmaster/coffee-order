package com.example.coffeeorder.service;

import com.example.coffeeorder.dto.TwosomeOrderHistory;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class TwosomeOrderHistoryParserTest {

    private final TwosomeOrderHistoryParser parser = new TwosomeOrderHistoryParser();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void parsesListStatusesAndPickupTime() throws IOException {
        JsonNode body = json("order-history-list.json");

        List<TwosomeOrderHistory.Summary> result = parser.parseList(body);

        assertThat(result).hasSize(2);
        assertThat(result.get(0).ordNo()).isEqualTo("TPSO2026110600000001");
        assertThat(result.get(0).orderedAt()).isEqualTo("2026-11-06T09:40");
        assertThat(result.get(0).pickupAt()).isEqualTo("2026-11-06T09:49");
        assertThat(result.get(1).statusCode()).isEqualTo("80");
        assertThat(result.get(1).pickupAt()).isNull();
    }

    @Test
    void parsesSimpleOrderNumberProgressPaymentsAndItemsWithoutAssumingLineTotals() throws IOException {
        TwosomeOrderHistory.Summary summary = parser.parseList(json("order-history-list.json")).get(0);

        TwosomeOrderHistory.Detail detail = parser.parseDetail(html("order-detail-completed.html"), summary);

        assertThat(detail.simpleOrderNo()).isEqualTo("907");
        assertThat(detail.currentStep()).isEqualTo("수령완료");
        assertThat(detail.steps()).extracting(TwosomeOrderHistory.Step::name)
                .containsExactly("결제완료", "주문전송", "주문접수", "준비완료", "수령완료");
        assertThat(detail.summary().statusCode()).isEqualTo("60");
        assertThat(detail.totalOrderAmount()).isEqualTo(16400);
        assertThat(detail.discountAmount()).isEqualTo(500);
        assertThat(detail.finalPaymentAmount()).isEqualTo(15900);
        assertThat(detail.paymentAmounts()).containsEntry("신용/체크카드", 15900);
        assertThat(detail.posSaleNo()).isEqualTo("2026110611021150100038");
        assertThat(detail.receiptNo()).isEqualTo("2026110611021150100038");
        assertThat(detail.itemsComplete()).isTrue();
        assertThat(detail.items()).hasSize(2);
        assertThat(detail.items().get(0).ordDtlNo()).isEqualTo("1");
        assertThat(detail.items().get(0).menuCd()).isEqualTo("10101010");
        assertThat(detail.items().get(1).quantity()).isEqualTo(2);
        assertThat(detail.items().get(1).displayUnitPrice()).isEqualTo(5300);
        assertThat(detail.items().get(1).displayLineAmount()).isEqualTo(5300);
    }

    @Test
    void canceledOrderKeepsDisplayedAmountButHasNoCompletedProgressOrReceipt() throws IOException {
        TwosomeOrderHistory.Summary summary = parser.parseList(json("order-history-list.json")).get(1);

        TwosomeOrderHistory.Detail detail = parser.parseDetail(html("order-detail-canceled.html"), summary);

        assertThat(detail.summary().statusCode()).isEqualTo("80");
        assertThat(detail.currentStep()).isNull();
        assertThat(detail.steps()).isEmpty();
        assertThat(detail.finalPaymentAmount()).isEqualTo(13900);
        assertThat(detail.posSaleNo()).isEqualTo("0000000000000000000000");
        assertThat(detail.receiptNo()).isNull();
        assertThat(detail.message()).contains("취소");
    }

    @Test
    void normalizesCustomOptionCodesAndQuantityButIgnoresRuntimeSequence() throws IOException {
        List<TwosomeOrderHistory.CustomOption> options = parser.parseCustomOptions(json("order-custom-options.json"));

        assertThat(options).hasSize(2);
        assertThat(options.get(0).cstmAddCd()).isEqualTo("SHOT");
        assertThat(options.get(0).quantity()).isEqualTo(1);
        assertThat(options.get(1).cstmChgCd()).isEqualTo("CARAMEL");
        assertThat(options.get(1).quantity()).isEqualTo(2);
    }

    @Test
    void rejectsIncompleteCustomOptionsInsteadOfNormalizingThemToValidValues() throws IOException {
        JsonNode body = objectMapper.readTree("{\"queryCode\":1000,\"fetchResultListSet\":[{"
                + "\"CSTM_NM\":\"샷 추가\",\"CSTM_GRP_CD\":\"10\","
                + "\"TYPE_ADD_CD\":\"A\",\"CSTM_ADD_CD\":\"SHOT\"}]}");

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> parser.parseCustomOptions(body))
                .isInstanceOf(com.example.coffeeorder.exception.TwosomeStoreException.class)
                .hasMessageContaining("불완전");
    }

    @Test
    void parsesApprovalEvidenceFromReceiptText() throws IOException {
        TwosomeOrderHistory.Receipt receipt = parser.parseReceipt(
                "2026110611021150100038", json("receipt.json"));

        assertThat(receipt.simpleOrderNo()).isEqualTo("907");
        assertThat(receipt.paymentAmount()).isEqualTo(15900);
        assertThat(receipt.approvalNo()).isEqualTo("12345678");
        assertThat(receipt.approvedAt()).isEqualTo("2026-11-06T09:40:43");
    }

    @Test
    void extractsCustomerNumberOnlyForTransientReceiptRequest() {
        String custNo = parser.extractReceiptCustNo(
                "<script>var receiptNo = \"receipt\"; var custNo = \"customer-number\";</script>");

        assertThat(custNo).isEqualTo("customer-number");
    }

    private JsonNode json(String name) throws IOException {
        return objectMapper.readTree(new ClassPathResource("fixtures/twosome/" + name).getInputStream());
    }

    private String html(String name) throws IOException {
        return new String(new ClassPathResource("fixtures/twosome/" + name).getInputStream().readAllBytes(),
                StandardCharsets.UTF_8);
    }
}
