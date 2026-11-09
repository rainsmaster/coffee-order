package com.example.coffeeorder.service;

import com.example.coffeeorder.client.TwosomeStoreApiClient;
import com.example.coffeeorder.dto.TwosomeCaptchaResponse;
import com.example.coffeeorder.dto.TwosomeCartAddRequest;
import com.example.coffeeorder.dto.TwosomeCartAddResponse;
import com.example.coffeeorder.dto.TwosomeCartItemRequest;
import com.example.coffeeorder.dto.TwosomeLoginRequest;
import com.example.coffeeorder.dto.TwosomeMenuOptionsResponse;
import com.example.coffeeorder.dto.TwosomeMenuResponse;
import com.example.coffeeorder.dto.TwosomeVariantResolveResponse;
import com.example.coffeeorder.entity.TwosomeMenu;
import com.example.coffeeorder.repository.OrderRepository;
import com.example.coffeeorder.repository.TwosomeMenuRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TwosomeStoreIntegrationServiceTest {

    @Mock
    private TwosomeStoreApiClient apiClient;
    @Mock
    private TwosomeMenuRepository menuRepository;
    @Mock
    private OrderRepository orderRepository;
    @Mock
    private TwosomeSessionRedisStore sessionRedisStore;
    @Mock
    private TwosomeHealthService healthService;
    @Mock
    private StringRedisTemplate stringRedisTemplate;
    @Mock
    private ObjectProvider<TwosomeMenuOptionService> optionServiceProvider;
    @Mock
    private TwosomeMenuOptionService optionService;
    @Mock
    private ValueOperations<String, String> valueOperations;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private TwosomeStoreIntegrationService service;

    @BeforeEach
    void setUp() {
        org.mockito.Mockito.lenient().when(optionServiceProvider.getObject()).thenReturn(optionService);
        service = new TwosomeStoreIntegrationService(
                apiClient, menuRepository, orderRepository, objectMapper,
                sessionRedisStore, healthService, stringRedisTemplate, optionServiceProvider);
    }

    @Test
    void refreshesSoftDeletedMenuWithoutDuplicateInsert() {
        TwosomeMenu deleted = menu("20501763");
        deleted.setDelYn("Y");
        when(menuRepository.findAll()).thenReturn(List.of(deleted));
        when(menuRepository.findByDelYnOrderByMidNmAscSortOrdAsc("N")).thenReturn(List.of());
        when(stringRedisTemplate.opsForValue()).thenReturn(valueOperations);

        TwosomeMenuResponse.TwosomeMenuItem item = new TwosomeMenuResponse.TwosomeMenuItem();
        item.setMenuCd("20501763");
        item.setMenuNm("재판매 메뉴");
        item.setMidCd("20");
        item.setMidNm("음료");
        item.setSaleAmt("4,200");
        item.setSalesPsblQty(-1);
        TwosomeMenuResponse response = new TwosomeMenuResponse();
        response.setQueryCode(1000);
        response.setFetchResultListSet(List.of(item));
        when(apiClient.fetchStoreMenus(any(), eq("1102115"))).thenReturn(response);

        activateAdminSession();
        int saved = service.refreshStoreMenus();

        assertThat(saved).isEqualTo(1);
        assertThat(deleted.getDelYn()).isEqualTo("N");
        assertThat(deleted.getSaleAmt()).isEqualTo(4200);
        verify(menuRepository).saveAll(org.mockito.ArgumentMatchers.argThat(menus -> {
            var iterator = menus.iterator();
            return iterator.hasNext() && iterator.next() == deleted && !iterator.hasNext();
        }));
    }

    @Test
    void rejectsBaseMenuWhenOptionVariantIsMissing() {
        TwosomeMenu menu = menu("10100001");
        when(menuRepository.findByMenuCd("10100001")).thenReturn(Optional.of(menu));
        when(optionService.getMenuOptions("rep:1", "10100001")).thenReturn(cupOptions());
        activateRepSession();

        TwosomeCartAddResponse response = service.addItemsToCart("rep:1", new TwosomeCartAddRequest(
                1L, List.of(cartItem("10100001", null, null))));

        assertThat(response.getSuccess()).isZero();
        assertThat(response.getFailed()).isEqualTo(1);
        assertThat(response.getResults().get(0).getMessage()).contains("변형 메뉴 코드");
        verify(apiClient, never()).addToCart(any(), anyString());
    }

    @Test
    void removesNewZeroPricedItemAfterSuccessfulCartAdd() throws Exception {
        TwosomeMenu menu = menu("10100001");
        when(menuRepository.findByMenuCd("10100001")).thenReturn(Optional.of(menu));
        when(optionService.getMenuOptions("rep:1", "10100001")).thenReturn(cupOptions());
        when(optionService.resolveVariant(eq("rep:1"), any())).thenReturn(
                new TwosomeVariantResolveResponse("10101001", "Americano", 5200, "Americano"));
        when(apiClient.fetchCartList(any(), eq("1102115"))).thenReturn(
                objectMapper.readTree("{\"resultCd\":\"0000\",\"cartStoreMenuList\":[]}"),
                objectMapper.readTree("{\"resultCd\":\"0000\",\"cartStoreMenuList\":["
                        + "{\"CART_NO\":\"cart-1\",\"CART_DTL_NO\":\"1\",\"MENU_CD\":\"10101001\","
                        + "\"UP_MENU_CD\":\"10100001\",\"SALE_AMT\":0,\"ORD_CNT\":1}]}"));
        when(apiClient.addToCart(any(), anyString())).thenReturn(
                new TwosomeStoreApiClient.CartAddResult(true, "0000", null));
        when(apiClient.deleteCartItem(any(), eq("cart-1"), eq("1"))).thenReturn(true);
        activateRepSession();

        TwosomeCartAddResponse response = service.addItemsToCart("rep:1", new TwosomeCartAddRequest(
                1L, List.of(cartItem("10100001", List.of("051T"), "10101001"))));

        assertThat(response.getSuccess()).isZero();
        assertThat(response.getFailed()).isEqualTo(1);
        assertThat(response.getResults().get(0).getMessage()).contains("자동 제거");
        verify(apiClient).deleteCartItem(any(), eq("cart-1"), eq("1"));
    }

    @Test
    void acceptsValidatedVariantWithPositivePrice() throws Exception {
        TwosomeMenu menu = menu("10100001");
        when(menuRepository.findByMenuCd("10100001")).thenReturn(Optional.of(menu));
        when(optionService.getMenuOptions("rep:1", "10100001")).thenReturn(cupOptions());
        when(optionService.resolveVariant(eq("rep:1"), any())).thenReturn(
                new TwosomeVariantResolveResponse("10101001", "Americano", 5200, "Americano"));
        when(apiClient.fetchCartList(any(), eq("1102115"))).thenReturn(
                objectMapper.readTree("{\"resultCd\":\"0000\",\"cartStoreMenuList\":[]}"),
                objectMapper.readTree("{\"resultCd\":\"0000\",\"cartStoreMenuList\":["
                        + "{\"CART_NO\":\"cart-2\",\"CART_DTL_NO\":\"1\",\"MENU_CD\":\"10101001\","
                        + "\"UP_MENU_CD\":\"10100001\",\"SALE_AMT\":5200,\"ORD_CNT\":1}]}"));
        when(apiClient.addToCart(any(), anyString())).thenReturn(
                new TwosomeStoreApiClient.CartAddResult(true, "0000", null));
        activateRepSession();

        TwosomeCartAddResponse response = service.addItemsToCart("rep:1", new TwosomeCartAddRequest(
                1L, List.of(cartItem("10100001", List.of("051T"), "10101001"))));

        assertThat(response.getSuccess()).isEqualTo(1);
        assertThat(response.getFailed()).isZero();
        verify(apiClient, never()).deleteCartItem(any(), anyString(), anyString());
    }

    @Test
    void doesNotRejectItemWhenPriceFieldIsMissing() throws Exception {
        TwosomeMenu menu = menu("10401690");
        when(menuRepository.findByMenuCd("10401690")).thenReturn(Optional.of(menu));
        when(optionService.getMenuOptions("rep:1", "10401690")).thenReturn(
                new TwosomeMenuOptionsResponse("10401690", true, null, List.of()));
        when(apiClient.fetchCartList(any(), eq("1102115"))).thenReturn(
                objectMapper.readTree("{\"resultCd\":\"0000\",\"cartStoreMenuList\":[]}"),
                objectMapper.readTree("{\"resultCd\":\"0000\",\"cartStoreMenuList\":["
                        + "{\"CART_NO\":\"cart-3\",\"CART_DTL_NO\":\"1\",\"MENU_CD\":\"10401690\","
                        + "\"UP_MENU_CD\":\"10401690\",\"ORD_CNT\":1}]}"));
        when(apiClient.addToCart(any(), anyString())).thenReturn(
                new TwosomeStoreApiClient.CartAddResult(true, "0000", null));
        activateRepSession();

        TwosomeCartAddResponse response = service.addItemsToCart("rep:1", new TwosomeCartAddRequest(
                1L, List.of(cartItem("10401690", null, null))));

        assertThat(response.getSuccess()).isEqualTo(1);
        assertThat(response.getFailed()).isZero();
        verify(apiClient, never()).deleteCartItem(any(), anyString(), anyString());
    }

    private TwosomeMenu menu(String menuCd) {
        TwosomeMenu menu = new TwosomeMenu();
        menu.setMenuCd(menuCd);
        menu.setMenuNm("Americano");
        menu.setMidCd("17");
        menu.setMidNm("커피");
        menu.setDelYn("N");
        return menu;
    }

    private TwosomeMenuOptionsResponse cupOptions() {
        return new TwosomeMenuOptionsResponse("10100001", true, null, List.of(
                new TwosomeMenuOptionsResponse.OptionGroup("051", "컵 선택", true, List.of(
                        new TwosomeMenuOptionsResponse.Option("051T", "일회용컵", false)))));
    }

    private TwosomeCartItemRequest cartItem(String menuCd, List<String> opts, String variantMenuCd) {
        return new TwosomeCartItemRequest(menuCd, menuCd, "17", 1, opts, variantMenuCd, List.of());
    }

    private void activateRepSession() {
        TwosomeCaptchaResponse captcha = issueCaptcha();
        service.loginForRep(1L, new TwosomeLoginRequest(
                captcha.getContextId(), "tester", "password", "123456"));
    }

    private void activateAdminSession() {
        TwosomeCaptchaResponse captcha = issueCaptcha();
        service.login(new TwosomeLoginRequest(
                captcha.getContextId(), "tester", "password", "123456"));
    }

    private TwosomeCaptchaResponse issueCaptcha() {
        when(apiClient.fetchCaptchaImage(any())).thenReturn(new byte[]{1});
        when(apiClient.setStoreInfo(any(), eq("1102115"), anyDouble(), anyDouble())).thenReturn("CJENM커머스부문점");
        return service.issueCaptcha();
    }
}
