package com.example.coffeeorder;

import com.example.coffeeorder.dto.TwosomeCartAddResponse;
import com.example.coffeeorder.dto.TwosomeCartItemResult;
import com.example.coffeeorder.dto.TwosomeSessionResponse;
import com.example.coffeeorder.entity.Department;
import com.example.coffeeorder.entity.Team;
import com.example.coffeeorder.entity.TwosomeMenu;
import com.example.coffeeorder.repository.DepartmentRepository;
import com.example.coffeeorder.repository.MemberRepository;
import com.example.coffeeorder.repository.TeamRepository;
import com.example.coffeeorder.repository.TwosomeMenuRepository;
import com.example.coffeeorder.service.TwosomeStoreIntegrationService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "admin.password=test-admin-password",
        "twosome.keepalive.enabled=false",
        "twosome.menu-refresh.enabled=false"
})
class RenewalApiIntegrationTest {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private DepartmentRepository departmentRepository;
    @Autowired
    private TeamRepository teamRepository;
    @Autowired
    private TwosomeMenuRepository twosomeMenuRepository;
    @Autowired
    private MemberRepository memberRepository;
    @Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    @MockitoBean
    private TwosomeStoreIntegrationService integrationService;

    private final Map<String, TwosomeSessionResponse> sessions = new HashMap<>();

    @BeforeEach
    void setUpExternalStub() {
        sessions.clear();
        when(integrationService.getSessionStatus(anyString())).thenAnswer(invocation ->
                sessions.getOrDefault(invocation.getArgument(0),
                        new TwosomeSessionResponse("NONE", null, null, 0L, null)));
        when(integrationService.addItemsToCart(anyString(), any())).thenAnswer(invocation ->
                new TwosomeCartAddResponse(1, 1, 0,
                        List.of(new TwosomeCartItemResult("테스트 Americano", "TEST-MENU", true, null))));
        when(integrationService.getCartItems(anyString())).thenReturn(List.of());
    }

    @Test
    void multipleOrdersAndSelectedRepresentativeFlow() throws Exception {
        Fixture first = createFixture("홍길동");
        Fixture second = createFixture(first.department(), "김대리", "SECOND-MENU");
        String firstOrder = createOrder(first, LocalDate.now());
        String secondOrder = createOrder(first, LocalDate.now());
        assertThat(secondOrder).isNotEqualTo(firstOrder);
        assertThat(jdbcTemplate.queryForObject(
                "select cast(order_date as varchar) from orders where id=?", String.class, firstOrder))
                .isEqualTo(LocalDate.now().toString());

        mockMvc.perform(get("/api/orders/today").param("departmentId", first.department().getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].orderDate").value(LocalDate.now().toString()));

        Long firstRepId = registerRep(first.team());
        Long secondRepId = registerRep(second.team());
        mockMvc.perform(get("/api/reps").param("departmentId", first.department().getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].twosomeStatus").value("NONE"))
                .andExpect(jsonPath("$[0].statusReason").value("로그인 필요"))
                .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("pinHash"))))
                .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("twosomePw"))));

        String firstSessionKey = TwosomeStoreIntegrationService.repSessionKey(firstRepId);
        sessions.put(firstSessionKey, new TwosomeSessionResponse("ACTIVE", "테스트점", null, 30L, null));
        Map<String, Object> cartRequest = Map.of(
                "targetRepMemberId", firstRepId,
                "items", List.of(Map.of("menuCd", "TEST-MENU", "upMenuCd", "TEST-MENU", "qty", 1)));
        mockMvc.perform(post("/api/rep/twosome/cart/add")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(cartRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(1));
        verify(integrationService).addItemsToCart(eq(firstSessionKey), any());

        mockMvc.perform(post("/api/orders/cart-reflected")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "orderIds", List.of(Long.valueOf(firstOrder), Long.valueOf(secondOrder)),
                                "targetRepMemberId", firstRepId))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.updatedCount").value(2));
        assertThat(jdbcTemplate.queryForObject(
                "select cart_reflected_by from orders where id=?", Long.class, firstOrder))
                .isEqualTo(firstRepId);
        assertThat(jdbcTemplate.queryForObject(
                "select cast(order_date as varchar) from orders where id=?", String.class, firstOrder))
                .isEqualTo(LocalDate.now().toString());
        mockMvc.perform(get("/api/orders/today").param("departmentId", first.department().getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].cartReflectedBy").value(firstRepId.intValue()))
                .andExpect(jsonPath("$[1].cartReflectedBy").value(firstRepId.intValue()));

        mockMvc.perform(get("/api/rep/twosome/cart").param("targetRepMemberId", firstRepId.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
        mockMvc.perform(post("/api/rep/twosome/cart/add")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "targetRepMemberId", secondRepId, "items", List.of()))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("TARGET_REP_SESSION_REQUIRED"));
    }

    @Test
    void pastOrdersRemainQueryableByDate() throws Exception {
        Fixture fixture = createFixture("과거주문자");
        LocalDate pastDate = LocalDate.now().minusDays(2);
        createOrder(fixture, pastDate);

        mockMvc.perform(get("/api/orders")
                        .param("date", pastDate.toString())
                        .param("departmentId", fixture.department().getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].teamName").value("과거주문자"))
                .andExpect(jsonPath("$[0].menuName").value("테스트 Americano"));
        mockMvc.perform(get("/api/orders/today").param("departmentId", fixture.department().getId().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void releaseNotesAndLegacyAdminRedirect() throws Exception {
        JsonNode login = readJson(mockMvc.perform(post("/api/admin/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("password", "test-admin-password"))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        String adminToken = login.get("token").asText();
        String version = "test-" + UUID.randomUUID();
        Map<String, Object> note = Map.of(
                "version", version,
                "title", "리뉴얼 안내",
                "summary", "다중 주문과 대표 선택",
                "content", "새 기능\n다중 주문\n개선 사항\n대표별 장바구니",
                "published", true);
        JsonNode created = readJson(mockMvc.perform(post("/api/admin/release-notes")
                        .header("X-Admin-Token", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(note)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.publishedAt").isNotEmpty())
                .andReturn().getResponse().getContentAsString());

        mockMvc.perform(get("/api/release-notes/latest"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(version));
        mockMvc.perform(get("/api/release-notes/{id}", created.get("id").asLong()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").value(note.get("content")));
        mockMvc.perform(get("/admin"))
                .andExpect(status().is3xxRedirection())
                .andExpect(header().string("Location", "/?manageTab=reps"));
    }

    private String createOrder(Fixture fixture, LocalDate orderDate) throws Exception {
        Map<String, Object> request = new HashMap<>();
        request.put("departmentId", fixture.department().getId());
        request.put("teamId", fixture.team().getId());
        request.put("twosomeMenuId", fixture.menu().getId());
        request.put("orderDate", orderDate.toString());
        request.put("personalOption", "아이스");
        JsonNode response = readJson(mockMvc.perform(post("/api/orders")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString());
        return response.get("id").asText();
    }

    private Long registerRep(Team team) throws Exception {
        mockMvc.perform(post("/api/rep/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "teamId", team.getId(), "pin", "123456"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty());
        return memberRepository.findByTeam_IdAndDelYn(team.getId(), "N").orElseThrow().getId();
    }

    private Fixture createFixture(String memberName) {
        Department department = new Department();
        department.setName("테스트부서-" + UUID.randomUUID());
        department = departmentRepository.save(department);
        return createFixture(department, memberName, "TEST-MENU");
    }

    private Fixture createFixture(Department department, String memberName, String menuCode) {
        Team team = new Team();
        team.setDepartment(department);
        team.setName(memberName);
        team = teamRepository.save(team);
        TwosomeMenu menu = new TwosomeMenu();
        menu.setMenuCd(menuCode + "-" + team.getId());
        menu.setMenuNm("테스트 Americano");
        menu.setMidNm("커피");
        menu.setSaleAmt(4500);
        menu.setSalesPsblQty(10);
        menu = twosomeMenuRepository.save(menu);
        return new Fixture(department, team, menu);
    }

    private JsonNode readJson(String content) throws Exception {
        return objectMapper.readTree(content);
    }

    private record Fixture(Department department, Team team, TwosomeMenu menu) {
    }
}
