package com.example.coffeeorder.service;

/**
 * 투썸 연동 헬스 이벤트 유형.
 * SUCCESS/FAIL을 별도 유형으로 둬 성공 이력과 실패 이력을 독립적으로 추적한다.
 */
public enum TwosomeHealthEventType {

    SESSION_RESTORED,
    AUTO_RELOGIN_SUCCESS,
    AUTO_RELOGIN_FAIL,
    KEEPALIVE_SUCCESS,
    KEEPALIVE_FAIL,
    MENU_SYNC_SUCCESS,
    MENU_SYNC_FAIL,
    CART_ADD_SUCCESS,
    CART_ADD_FAIL
}
