package com.example.coffeeorder.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class TwosomeMenuOptionServiceTest {

    private final TwosomeMenuOptionService service = new TwosomeMenuOptionService(
            null, null, new ObjectMapper());

    @Test
    void parsesDrizzleAsToggleGroupsWithNormalSelectedByDefault() {
        String html = category("9004", "드리즐",
                choiceGroup("9004-10", "카라멜드리즐", "드리즐")
                + choiceGroup("9004-20", "초콜릿드리즐", "드리즐"));

        JsonNode result = service.parseCustomPanelHtml("10101030", html);

        assertThat(result.path("hasCustom").asBoolean()).isTrue();
        assertThat(result.path("choiceGroups")).hasSize(2);
        JsonNode caramel = result.path("choiceGroups").get(0);
        assertThat(caramel.path("name").asText()).isEqualTo("카라멜드리즐");
        assertThat(caramel.path("toggleable").asBoolean()).isTrue();
        assertThat(caramel.path("defaultChoiceKey").asText()).isEqualTo("9004-10-20");
        assertThat(caramel.path("displayPrice").asInt()).isEqualTo(800);
        assertThat(caramel.path("choices")).hasSize(3);
        assertThat(result.path("categories").get(0).path("categoryName").asText()).isEqualTo("드리즐");
        assertThat(result.path("categories").get(0).path("choiceGroups")).hasSize(2);
    }

    @Test
    void keepsAdjustmentOnlyOptionsVisibleAndMilkChoicesExclusive() {
        String html = category("1000", "샷 조절", """
                <div class="items">
                  <h3><span class="label">에스프레소 샷</span></h3>
                  <div class="option_select">
                    <input type="radio" name="radio_custom1000-10" id="radio_custom1000-10-10"
                           data-id="에스프레소 샷연하게" data-price="0">
                    <label for="radio_custom1000-10-10">연하게</label>
                    <input type="hidden" id="cstmInfo1000-10-10" value="1000---20-10">
                    <input type="hidden" id="chgYn1000-10-10" value="Y">
                  </div>
                </div>
                """)
                + category("3004", "우유/식물성 음료", choiceGroup("3004-00", "기본(조정만)", ""));

        JsonNode result = service.parseCustomPanelHtml("10101030", html);

        JsonNode shot = result.path("choiceGroups").get(0);
        assertThat(shot.path("toggleable").asBoolean()).isFalse();
        assertThat(shot.has("defaultChoiceKey")).isFalse();
        assertThat(shot.path("choices").get(0).path("chgYn").asText()).isEqualTo("Y");
        JsonNode milk = result.path("choiceGroups").get(1);
        assertThat(milk.path("name").asText()).isEqualTo("기본(조정만)");
        assertThat(milk.path("exclusiveGroupKey").asText()).isEqualTo("3004");
        assertThat(milk.path("defaultChoiceKey").asText()).isEqualTo("3004-00-20");
    }

    @Test
    void assignsQuantityOptionsToTheirOfficialCategory() {
        String html = category("1001", "샷 추가", """
                <div class="items">
                  <input type="number" id="spinner_box_qty1001-10" data-data="1001-10"
                         data-id="에스프레소 샷 추가" data-price="800">
                  <input type="hidden" id="cstmInfo1001-10" value="1001-10-10--">
                  <input type="hidden" id="deposit1001-10" value="0">
                </div>
                """);

        JsonNode result = service.parseCustomPanelHtml("10101030", html);

        JsonNode item = result.path("qtyItems").get(0);
        assertThat(item.path("categoryKey").asText()).isEqualTo("1001");
        assertThat(item.path("maxQty").asInt()).isEqualTo(2);
        assertThat(result.path("categories").get(0).path("categoryName").asText()).isEqualTo("샷 추가");
        assertThat(result.path("categories").get(0).path("qtyItems")).hasSize(1);
    }

    private String category(String key, String name, String body) {
        return """
                <article class="collapse">
                  <div class="collapse-header">
                    <a data-action="collapse" data-id="%s"><div class="name">%s</div></a>
                  </div>
                  <div class="collapse-body">%s</div>
                </article>
                """.formatted(key, name, body);
    }

    private String choiceGroup(String groupKey, String groupName, String labelPrefix) {
        return """
                <div class="items">
                  <h3>
                    <span class="label">
                      <div class="checkbox all_check">
                        <input type="checkbox" data-data="%s">
                        <label>%s</label>
                      </div>
                    </span>
                    <span class="selected_value">(<em class="data-custom-price2">800</em>원)</span>
                  </h3>
                  <div class="option_select" style="display: none;">
                    %s%s%s
                  </div>
                </div>
                """.formatted(groupKey, groupName,
                choice(groupKey, "10", labelPrefix + "많이"),
                choice(groupKey, "20", labelPrefix + "보통"),
                choice(groupKey, "30", labelPrefix + "적게"));
    }

    private String choice(String groupKey, String code, String label) {
        String key = groupKey + "-" + code;
        return """
                <input type="radio" name="radio_custom%s" id="radio_custom%s" data-price="800">
                <label for="radio_custom%s">%s</label>
                <input type="hidden" id="cstmInfo%s" value="%s-10-20-%s">
                <input type="hidden" id="chgYn%s" value="N">
                <input type="hidden" id="deposit%s" value="0">
                """.formatted(groupKey, key, key, label, key, groupKey, code, key, key);
    }
}
