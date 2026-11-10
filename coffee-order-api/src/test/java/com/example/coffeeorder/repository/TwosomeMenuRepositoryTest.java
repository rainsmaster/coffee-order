package com.example.coffeeorder.repository;

import com.example.coffeeorder.entity.TwosomeMenu;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.TestPropertySource;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:menu_repository_test;DB_CLOSE_DELAY=-1",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class TwosomeMenuRepositoryTest {

    @Autowired
    private TwosomeMenuRepository repository;

    @Test
    void storesSameMenuCodeForDifferentCategories() {
        TwosomeMenu regular = menu("01", "커피", "아메리칸노");
        TwosomeMenu decaf = menu("17", "디카페인 커피", "디카페인 아메리칸노");

        repository.saveAll(List.of(regular, decaf));
        repository.flush();

        assertThat(repository.findByMenuCdAndMidCd("10100001", "01"))
                .get().extracting(TwosomeMenu::getMenuNm).isEqualTo("아메리칸노");
        assertThat(repository.findByMenuCdAndMidCd("10100001", "17"))
                .get().extracting(TwosomeMenu::getMenuNm).isEqualTo("디카페인 아메리칸노");
        assertThat(repository.findStoreMenus())
                .extracting(TwosomeMenu::getMenuNm)
                .containsExactlyInAnyOrder("아메리칸노", "디카페인 아메리칸노");
    }

    private TwosomeMenu menu(String midCd, String midNm, String menuNm) {
        TwosomeMenu menu = new TwosomeMenu();
        menu.setMenuCd("10100001");
        menu.setMenuNm(menuNm);
        menu.setMidCd(midCd);
        menu.setMidNm(midNm);
        menu.setSaleAmt(5200);
        menu.setSalesPsblQty(-1);
        menu.setDelYn("N");
        return menu;
    }
}
