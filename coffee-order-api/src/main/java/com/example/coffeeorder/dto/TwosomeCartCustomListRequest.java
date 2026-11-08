package com.example.coffeeorder.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class TwosomeCartCustomListRequest {

    private String cartNo;
    private String cartDtlNo;
    private Long targetRepMemberId;
}
