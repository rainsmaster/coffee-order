package com.example.coffeeorder.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class CartReflectedRequest {

    @NotEmpty
    private List<Long> orderIds;

    @NotNull
    private Long targetRepMemberId;
}
