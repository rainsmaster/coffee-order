package com.example.coffeeorder.dto;

public record TwosomeCartSnapshotEntry(
        String cartNo,
        String cartDtlNo,
        TwosomeOrderHistory.Item item) {
}
