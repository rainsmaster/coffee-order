package com.example.coffeeorder.service;

import com.example.coffeeorder.dto.TwosomeCartSnapshotEntry;
import com.example.coffeeorder.dto.TwosomeOrderHistory;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Component
public class TwosomeCartOrderMatcher {

    public MatchResult match(List<TwosomeCartSnapshotEntry> before,
                             List<TwosomeOrderHistory.Item> ordered,
                             List<TwosomeCartSnapshotEntry> after) {
        try {
            Map<ItemKey, Integer> expected = quantities(before);
            for (TwosomeOrderHistory.Item item : ordered) {
                ItemKey key = ItemKey.from(item);
                int remaining = expected.getOrDefault(key, 0) - item.quantity();
                if (remaining < 0) {
                    return new MatchResult(false, "주문 항목이 결제 전 장바구니와 다릅니다.");
                }
                if (remaining == 0) {
                    expected.remove(key);
                } else {
                    expected.put(key, remaining);
                }
            }
            Map<ItemKey, Integer> actualAfter = quantities(after);
            if (!expected.equals(actualAfter)) {
                return new MatchResult(false, "주문 후 장바구니 차감 결과가 일치하지 않습니다.");
            }
            return new MatchResult(true, null);
        } catch (IllegalArgumentException e) {
            return new MatchResult(false, e.getMessage());
        }
    }

    private Map<ItemKey, Integer> quantities(List<TwosomeCartSnapshotEntry> entries) {
        Map<ItemKey, Integer> result = new HashMap<>();
        for (TwosomeCartSnapshotEntry entry : entries) {
            if (entry.item() == null) {
                throw new IllegalArgumentException("장바구니 항목 해석이 완료되지 않았습니다.");
            }
            ItemKey key = ItemKey.from(entry.item());
            result.merge(key, entry.item().quantity(), Integer::sum);
        }
        return result;
    }

    public record MatchResult(boolean matched, String reason) {
    }

    private record ItemKey(String menuCd, List<CustomKey> customOptions) {
        static ItemKey from(TwosomeOrderHistory.Item item) {
            if (item.menuCd() == null || item.menuCd().isBlank() || item.quantity() <= 0) {
                throw new IllegalArgumentException("메뉴 코드 또는 수량을 해석하지 못했습니다.");
            }
            List<CustomKey> options = new ArrayList<>();
            for (TwosomeOrderHistory.CustomOption option : item.customOptions()) {
                options.add(new CustomKey(
                        Objects.toString(option.grpCd(), ""),
                        Objects.toString(option.typeAddCd(), ""),
                        Objects.toString(option.cstmAddCd(), ""),
                        Objects.toString(option.typeChgCd(), ""),
                        Objects.toString(option.cstmChgCd(), ""),
                        option.quantity()));
            }
            options.sort(Comparator.comparing(CustomKey::grpCd)
                    .thenComparing(CustomKey::typeAddCd)
                    .thenComparing(CustomKey::cstmAddCd)
                    .thenComparing(CustomKey::typeChgCd)
                    .thenComparing(CustomKey::cstmChgCd)
                    .thenComparingInt(CustomKey::quantity));
            return new ItemKey(item.menuCd(), List.copyOf(options));
        }
    }

    private record CustomKey(String grpCd, String typeAddCd, String cstmAddCd,
                             String typeChgCd, String cstmChgCd, int quantity) {
    }
}
