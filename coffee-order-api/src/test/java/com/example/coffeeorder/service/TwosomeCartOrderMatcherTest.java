package com.example.coffeeorder.service;

import com.example.coffeeorder.dto.TwosomeCartSnapshotEntry;
import com.example.coffeeorder.dto.TwosomeOrderHistory;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class TwosomeCartOrderMatcherTest {

    private final TwosomeCartOrderMatcher matcher = new TwosomeCartOrderMatcher();

    @Test
    void matchesFullPaymentWithDuplicateLinesAndNormalizedCustomOptions() {
        List<TwosomeOrderHistory.CustomOption> options = List.of(
                custom("20", "", "", "C", "CARAMEL", 2),
                custom("10", "A", "SHOT", "", "", 1));
        List<TwosomeOrderHistory.CustomOption> reversed = List.of(options.get(1), options.get(0));
        List<TwosomeCartSnapshotEntry> before = List.of(
                cart("c1", "1", item("1", "A", 1, options)),
                cart("c1", "2", item("2", "A", 2, reversed)),
                cart("c1", "3", item("3", "B", 1, List.of())));
        List<TwosomeOrderHistory.Item> ordered = List.of(
                item("9", "A", 3, reversed), item("10", "B", 1, List.of()));

        TwosomeCartOrderMatcher.MatchResult result = matcher.match(before, ordered, List.of());

        assertThat(result.matched()).isTrue();
    }

    @Test
    void matchesOnlyExactRemainingMultiset() {
        List<TwosomeCartSnapshotEntry> before = List.of(
                cart("c1", "1", item("1", "A", 2, List.of())),
                cart("c1", "2", item("2", "B", 1, List.of())));
        List<TwosomeOrderHistory.Item> ordered = List.of(item("9", "A", 1, List.of()));
        List<TwosomeCartSnapshotEntry> after = List.of(
                cart("c2", "1", item("1", "A", 1, List.of())),
                cart("c2", "2", item("2", "B", 1, List.of())));

        assertThat(matcher.match(before, ordered, after).matched()).isTrue();
        assertThat(matcher.match(before, ordered, after.subList(0, 1)).matched()).isFalse();
    }

    @Test
    void rejectsDifferentCustomOptionsEvenWhenMenuAndQuantityMatch() {
        List<TwosomeCartSnapshotEntry> before = List.of(cart("c1", "1",
                item("1", "A", 1, List.of(custom("10", "A", "SHOT", "", "", 1)))));
        List<TwosomeOrderHistory.Item> ordered = List.of(item("9", "A", 1,
                List.of(custom("10", "A", "SYRUP", "", "", 1))));

        TwosomeCartOrderMatcher.MatchResult result = matcher.match(before, ordered, List.of());

        assertThat(result.matched()).isFalse();
        assertThat(result.reason()).contains("다릅니다");
    }

    @Test
    void rejectsUnrelatedCartChangeDuringPayment() {
        List<TwosomeCartSnapshotEntry> before = List.of(cart("c1", "1", item("1", "A", 1, List.of())));
        List<TwosomeOrderHistory.Item> ordered = List.of(item("9", "A", 1, List.of()));
        List<TwosomeCartSnapshotEntry> after = List.of(cart("c1", "2", item("2", "B", 1, List.of())));

        assertThat(matcher.match(before, ordered, after).matched()).isFalse();
    }

    private static TwosomeCartSnapshotEntry cart(String cartNo, String dtlNo, TwosomeOrderHistory.Item item) {
        return new TwosomeCartSnapshotEntry(cartNo, dtlNo, item);
    }

    private static TwosomeOrderHistory.Item item(String dtlNo, String menuCd, int quantity,
                                                  List<TwosomeOrderHistory.CustomOption> options) {
        return new TwosomeOrderHistory.Item(dtlNo, menuCd, "메뉴" + menuCd, null,
                quantity, 5000, 5000, options);
    }

    private static TwosomeOrderHistory.CustomOption custom(String group, String typeAdd, String add,
                                                            String typeChange, String change, int quantity) {
        return new TwosomeOrderHistory.CustomOption("옵션", group, typeAdd, add, typeChange, change, quantity);
    }
}
