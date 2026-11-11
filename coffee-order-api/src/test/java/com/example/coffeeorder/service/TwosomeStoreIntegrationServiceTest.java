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
    private TwosomeAutoReloginGuard autoReloginGuard;
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
                sessionRedisStore, healthService, autoReloginGuard, stringRedisTemplate, optionServiceProvider);
    }

    @Test
    void refreshesSoftDeletedMenuWithoutDuplicateInsert() {
        TwosomeMenu deleted = menu("20501763");
        deleted.setDelYn("Y");
        deleted.setMidCd("20");
        deleted.setMidNm("음료");
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
    void hidesMissingStoreMenuWhilePreservingOrderHistory() {
        TwosomeMenu discontinued = menu("10302165");
        discontinued.setId(34L);
        discontinued.setMidCd("02");
        discontinued.setMidNm("음료");
        when(menuRepository.findAll()).thenReturn(List.of(discontinued));
        when(menuRepository.findByDelYnOrderByMidNmAscSortOrdAsc("N")).thenReturn(List.of(discontinued));
        when(orderRepository.existsByTwosomeMenuId(34L)).thenReturn(true);
        when(stringRedisTemplate.opsForValue()).thenReturn(valueOperations);

        TwosomeMenuResponse.TwosomeMenuItem current = new TwosomeMenuResponse.TwosomeMenuItem();
        current.setMenuCd("10401684");
        current.setMenuNm("프랭클린(라즈베리)");
        current.setMidCd("02");
        current.setMidNm("음료");
        current.setSaleAmt("4,000");
        current.setSalesPsblQty(-1);
        TwosomeMenuResponse response = new TwosomeMenuResponse();
        response.setQueryCode(1000);
        response.setFetchResultListSet(List.of(current));
        when(apiClient.fetchStoreMenus(any(), eq("1102115"))).thenReturn(response);

        activateAdminSession();
        service.refreshStoreMenus();

        assertThat(discontinued.getDelYn()).isEqualTo("Y");
        verify(menuRepository).saveAll(org.mockito.ArgumentMatchers.argThat(menus -> {
            for (TwosomeMenu item : menus) {
                if (item == discontinued) return true;
            }
            return false;
        }));
    }

    @Test
    void keepsSameMenuCodeInSeparateCategories() {
        TwosomeMenu decaf = menu("10100001");
        decaf.setMidNm("디카페인 커피");
        when(menuRepository.findAll()).thenReturn(List.of(decaf));
        when(menuRepository.findByDelYnOrderByMidNmAscSortOrdAsc("N")).thenReturn(List.of(decaf));
        when(stringRedisTemplate.opsForValue()).thenReturn(valueOperations);

        TwosomeMenuResponse.TwosomeMenuItem regular = new TwosomeMenuResponse.TwosomeMenuItem();
        regular.setMenuCd("10100001");
        regular.setMenuNm("아메리칸노");
        regular.setMidCd("01");
        regular.setMidNm("커피");
        regular.setSaleAmt("5,200");
        regular.setSalesPsblQty(-1);
        TwosomeMenuResponse.TwosomeMenuItem decafItem = new TwosomeMenuResponse.TwosomeMenuItem();
        decafItem.setMenuCd("10100001");
        decafItem.setMenuNm("디카페인 아메리칸노");
        decafItem.setMidCd("17");
        decafItem.setMidNm("디카페인 커피");
        decafItem.setSaleAmt("5,200");
        decafItem.setSalesPsblQty(-1);
        TwosomeMenuResponse response = new TwosomeMenuResponse();
        response.setQueryCode(1000);
        response.setFetchResultListSet(List.of(decafItem, regular));
        when(apiClient.fetchStoreMenus(any(), eq("1102115"))).thenReturn(response);

        activateAdminSession();
        int saved = service.refreshStoreMenus();

        assertThat(saved).isEqualTo(2);
        assertThat(decaf.getMenuNm()).isEqualTo("디카페인 아메리칸노");
        org.mockito.ArgumentCaptor<java.util.List<TwosomeMenu>> captor =
                org.mockito.ArgumentCaptor.forClass(java.util.List.class);
        verify(menuRepository).saveAll(captor.capture());
        List<TwosomeMenu> savedMenus = captor.getValue();
        assertThat(savedMenus).hasSize(2).contains(decaf);
        assertThat(savedMenus).anyMatch(item -> "01".equals(item.getMidCd())
                && "아메리칸노".equals(item.getMenuNm()));
    }

    @Test
    void rejectsBaseMenuWhenOptionVariantIsMissing() {
        TwosomeMenu menu = menu("10100001");
        when(menuRepository.findByMenuCdAndMidCd("10100001", "17")).thenReturn(Optional.of(menu));
        when(optionService.getMenuOptions("rep:1", "10100001", "17")).thenReturn(cupOptions());
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
        when(menuRepository.findByMenuCdAndMidCd("10100001", "17")).thenReturn(Optional.of(menu));
        when(optionService.getMenuOptions("rep:1", "10100001", "17")).thenReturn(cupOptions());
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
        when(menuRepository.findByMenuCdAndMidCd("10100001", "17")).thenReturn(Optional.of(menu));
        when(optionService.getMenuOptions("rep:1", "10100001", "17")).thenReturn(cupOptions());
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
    void usesDefaultVariantAndFinalPriceForHoneyLemonAde() throws Exception {
        TwosomeMenu menu = menu("10302165");
        menu.setMidCd("02");
        menu.setMidNm("음료");
        menu.setDefaultMenuCd("10302175");
        when(menuRepository.findByMenuCdAndMidCd("10302165", "02")).thenReturn(Optional.of(menu));
        when(optionService.getMenuOptions("rep:1", "10302165", "02")).thenReturn(
                new TwosomeMenuOptionsResponse("10302165", true, "옵션이 없는 메뉴입니다.", List.of()));
        when(apiClient.fetchCartList(any(), eq("1102115"))).thenReturn(
                objectMapper.readTree("{\"resultCd\":\"0000\",\"cartStoreMenuList\":[]}"),
                objectMapper.readTree("{\"resultCd\":\"0000\",\"cartStoreMenuList\":["
                        + "{\"CART_NO\":\"cart-honey\",\"CART_DTL_NO\":\"1\",\"MENU_CD\":\"10302175\","
                        + "\"UP_MENU_CD\":\"10302165\",\"MID_CD\":\"02\",\"SALE_AMT\":0,"
                        + "\"FINAL_PRC\":5800,\"ORD_CNT\":1}]}"));
        when(apiClient.addToCart(any(), anyString())).thenReturn(
                new TwosomeStoreApiClient.CartAddResult(true, "0000", null));
        activateRepSession();

        TwosomeCartItemRequest honeyRequest = cartItem("10302165", null, null);
        honeyRequest.setMidCd("02");
        TwosomeCartAddResponse response = service.addItemsToCart("rep:1", new TwosomeCartAddRequest(
                1L, List.of(honeyRequest)));

        assertThat(response.getSuccess()).isEqualTo(1);
        assertThat(response.getFailed()).isZero();
        verify(apiClient).addToCart(any(), org.mockito.ArgumentMatchers.argThat(json ->
                json.contains("\"MENU_CD\":\"10302175\"")
                        && json.contains("\"UP_MENU_CD\":\"10302165\"")
                        && json.contains("\"MID_CD\":\"02\"")));
        verify(apiClient, never()).deleteCartItem(any(), anyString(), anyString());
    }

    @Test
    void doesNotRejectItemWhenPriceFieldIsMissing() throws Exception {
        TwosomeMenu menu = menu("10401690");
        when(menuRepository.findByMenuCdAndMidCd("10401690", "17")).thenReturn(Optional.of(menu));
        when(optionService.getMenuOptions("rep:1", "10401690", "17")).thenReturn(
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

    @Test
    void marksHttpLoginRejectionAsNonRetryable() {
        when(apiClient.fetchCaptchaImage(any())).thenReturn(new byte[]{1});
        TwosomeCaptchaResponse captcha = service.issueCaptcha();
        when(apiClient.login(any(), anyString(), anyString(), anyString()))
                .thenThrow(new com.example.coffeeorder.exception.TwosomeStoreException(
                        "투썸 서버가 오류를 반환했습니다. (HTTP 403)"));

        com.example.coffeeorder.dto.TwosomeLoginResponse response = service.loginForRep(1L,
                new TwosomeLoginRequest(captcha.getContextId(), "tester", "wrong-password", "123456"));

        assertThat(response.getStatus()).isEqualTo("FAILED");
        assertThat(response.getRstCd()).isEqualTo("LOGIN_ERROR");
    }

    @Test
    void persistsRepresentativeSessionOnLogin() {
        activateRepSession();

        verify(sessionRedisStore).save(eq("rep:1"), any(TwosomeSessionRedisStore.StoredSession.class));
        verify(autoReloginGuard).clear("rep:1");
    }

    @Test
    void restoresAdminAndRepresentativeSessionsTogether() {
        TwosomeSessionRedisStore.StoredSession admin = new TwosomeSessionRedisStore.StoredSession(
                java.util.Map.of("session", "admin-cookie"), "CJENM커머스부문점", "admin",
                java.time.LocalDateTime.now().minusHours(1));
        TwosomeSessionRedisStore.StoredSession rep = new TwosomeSessionRedisStore.StoredSession(
                java.util.Map.of("session", "rep-cookie"), "CJENM커머스부문점", "rep-user",
                java.time.LocalDateTime.now().minusHours(1));
        when(sessionRedisStore.loadAll()).thenReturn(java.util.Map.of("active", admin, "rep:42", rep));
        when(apiClient.setStoreInfo(any(), eq("1102115"), anyDouble(), anyDouble()))
                .thenReturn("CJENM커머스부문점");

        service.restoreSessionFromRedis();

        assertThat(service.getSessionStatus().getStatus()).isEqualTo("ACTIVE");
        assertThat(service.getSessionStatus().getSource()).isEqualTo("RESTORED");
        assertThat(service.getSessionStatus("rep:42").getStatus()).isEqualTo("ACTIVE");
        assertThat(service.getSessionStatus("rep:42").getSource()).isEqualTo("RESTORED");
        verify(sessionRedisStore).save(eq("active"), any(TwosomeSessionRedisStore.StoredSession.class));
        verify(sessionRedisStore).save(eq("rep:42"), any(TwosomeSessionRedisStore.StoredSession.class));
    }

    @Test
    void expiresOnlyTheRejectedRepresentativeSession() {
        activateRepSession();
        TwosomeCaptchaResponse secondCaptcha = issueCaptcha();
        service.loginForRep(2L, new TwosomeLoginRequest(
                secondCaptcha.getContextId(), "tester2", "password", "123456"));
        when(apiClient.setStoreInfo(any(), eq("1102115"), anyDouble(), anyDouble()))
                .thenThrow(new com.example.coffeeorder.exception.TwosomeStoreSessionExpiredException("401"));

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.keepAliveRepSession(1L))
                .isInstanceOf(com.example.coffeeorder.exception.TwosomeStoreSessionExpiredException.class);

        verify(sessionRedisStore).delete("rep:1");
        verify(sessionRedisStore, never()).delete("rep:2");
        assertThat(service.getSessionStatus("rep:1").getStatus()).isEqualTo("EXPIRED");
        assertThat(service.getSessionStatus("rep:2").getStatus()).isEqualTo("ACTIVE");
    }

    @Test
    void preservesCachedOptionsWhenMenuStructureIsUnchanged() {
        TwosomeMenu existing = menu("10100001");
        existing.setId(1L);
        existing.setDefaultMenuCd("variant-1");
        existing.setOptionData("cached-options");
        when(menuRepository.findAll()).thenReturn(List.of(existing));
        when(menuRepository.findByDelYnOrderByMidNmAscSortOrdAsc("N")).thenReturn(List.of(existing));
        when(stringRedisTemplate.opsForValue()).thenReturn(valueOperations);

        TwosomeMenuResponse.TwosomeMenuItem item = new TwosomeMenuResponse.TwosomeMenuItem();
        item.setMenuCd("10100001");
        item.setMenuNm("아메리칸노");
        item.setMidCd("17");
        item.setMidNm("커피");
        item.setDefaultMenuCd("variant-1");
        item.setSaleAmt("5,200");
        item.setSalesPsblQty(-1);
        TwosomeMenuResponse response = new TwosomeMenuResponse();
        response.setFetchResultListSet(List.of(item));
        when(apiClient.fetchStoreMenus(any(), eq("1102115"))).thenReturn(response);

        activateAdminSession();
        service.refreshStoreMenus();

        assertThat(existing.getOptionData()).isEqualTo("cached-options");
        verify(optionService).clearCustomOptionsCache();
    }

    @Test
    void prewarmsOnlyMenusWithoutCachedOptions() {
        TwosomeMenu menu = menu("10100001");
        menu.setMenuNm("아메리칸노");
        when(menuRepository.findStoreMenus()).thenReturn(List.of(menu));
        when(optionService.getMenuOptions("active", "10100001", "17")).thenReturn(cupOptions());
        activateAdminSession();

        assertThat(service.prewarmMenuOptions(10)).isEqualTo(1);
        verify(optionService).getMenuOptions("active", "10100001", "17");
    }

    @Test
    void sharesOneStoreInfoRequestBetweenConcurrentCallers() throws Exception {
        com.fasterxml.jackson.databind.node.ArrayNode storeList = objectMapper.createArrayNode();
        storeList.addObject().put("STORE_NM", "CJENM커머스부문점").put("ORD_TIME", "07:30~20:50");
        java.util.concurrent.CountDownLatch started = new java.util.concurrent.CountDownLatch(1);
        java.util.concurrent.CountDownLatch release = new java.util.concurrent.CountDownLatch(1);
        when(apiClient.fetchStoreDetailInfo(any(), eq("1102115"), anyDouble(), anyDouble())).thenAnswer(invocation -> {
            started.countDown();
            release.await(2, java.util.concurrent.TimeUnit.SECONDS);
            return storeList;
        });
        java.util.concurrent.ExecutorService executor = java.util.concurrent.Executors.newFixedThreadPool(2);
        try {
            java.util.concurrent.Future<String> first = executor.submit(() -> service.getStoreInfo().getStoreNm());
            assertThat(started.await(1, java.util.concurrent.TimeUnit.SECONDS)).isTrue();
            java.util.concurrent.Future<String> second = executor.submit(() -> service.getStoreInfo().getStoreNm());
            release.countDown();

            assertThat(first.get(2, java.util.concurrent.TimeUnit.SECONDS)).isEqualTo("CJENM커머스부문점");
            assertThat(second.get(2, java.util.concurrent.TimeUnit.SECONDS)).isEqualTo("CJENM커머스부문점");
            verify(apiClient).fetchStoreDetailInfo(any(), eq("1102115"), anyDouble(), anyDouble());
        } finally {
            release.countDown();
            executor.shutdownNow();
        }
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
