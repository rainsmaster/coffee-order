package com.example.coffeeorder.service;

import com.example.coffeeorder.dto.TwosomeMenuOptionsResponse;
import com.example.coffeeorder.entity.TwosomeMenu;
import com.example.coffeeorder.repository.TwosomeMenuRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TwosomeMenuCategoryOptionTest {

    @Mock
    private TwosomeMenuRepository menuRepository;
    @Mock
    private TwosomeStoreIntegrationService integrationService;

    private TwosomeMenuOptionService service;

    @BeforeEach
    void setUp() {
        service = new TwosomeMenuOptionService(menuRepository, integrationService, new ObjectMapper());
    }

    @Test
    void readsOptionCacheForTheRequestedCategory() {
        TwosomeMenu regular = menu("01", "040A", "블랙그라운드");
        TwosomeMenu decaf = menu("17", "040D", "디카페인");
        when(menuRepository.findByMenuCdAndMidCd("10100001", "01")).thenReturn(Optional.of(regular));
        when(menuRepository.findByMenuCdAndMidCd("10100001", "17")).thenReturn(Optional.of(decaf));

        TwosomeMenuOptionsResponse regularOptions = service.getMenuOptions("active", "10100001", "01");
        TwosomeMenuOptionsResponse decafOptions = service.getMenuOptions("active", "10100001", "17");

        assertThat(regularOptions.getGroups().get(0).getOptions().get(0).getOpts()).isEqualTo("040A");
        assertThat(decafOptions.getGroups().get(0).getOptions().get(0).getOpts()).isEqualTo("040D");
        verify(integrationService, never()).fetchMenuDetailHtml(
                org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString());
    }

    private TwosomeMenu menu(String midCd, String optCd, String optNm) {
        TwosomeMenu menu = new TwosomeMenu();
        menu.setMenuCd("10100001");
        menu.setMenuNm("아메리칸노");
        menu.setMidCd(midCd);
        menu.setOptionData("{\"menuCd\":\"10100001\",\"parsed\":true,\"groups\":[{"
                + "\"grpCd\":\"040\",\"grpNm\":\"원두\",\"required\":false,\"options\":[{"
                + "\"opts\":\"" + optCd + "\",\"optNm\":\"" + optNm + "\",\"defaultOpt\":true}]}]}");
        return menu;
    }
}
