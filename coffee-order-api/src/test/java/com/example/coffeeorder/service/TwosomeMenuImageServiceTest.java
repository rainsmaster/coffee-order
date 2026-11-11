package com.example.coffeeorder.service;

import com.example.coffeeorder.entity.TwosomeMenu;
import com.example.coffeeorder.repository.TwosomeMenuRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class TwosomeMenuImageServiceTest {

    private static final byte[] PNG = Base64.getDecoder().decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=");

    @TempDir
    private Path imageDirectory;
    @Mock
    private TwosomeMenuRepository menuRepository;
    @Mock
    private HttpClient httpClient;
    @Mock
    private HttpResponse<java.io.InputStream> response;

    private TwosomeMenuImageService service;

    @BeforeEach
    void setUp() {
        service = new TwosomeMenuImageService(menuRepository, imageDirectory, httpClient,
                (source, target) -> Files.write(target, "webp".getBytes(StandardCharsets.UTF_8)));
    }

    @Test
    void downloadsNewImageAndAssignsSameLocalPathToAllCategories() throws Exception {
        stubImageResponse();
        TwosomeMenu regular = menu("01");
        TwosomeMenu decaf = menu("17");

        int synchronizedCount = service.synchronizeMenus(List.of(regular, decaf));

        assertThat(synchronizedCount).isEqualTo(1);
        assertThat(regular.getLocalImgPath()).isEqualTo("/images/twosome/10100001.png");
        assertThat(decaf.getLocalImgPath()).isEqualTo(regular.getLocalImgPath());
        assertThat(imageDirectory.resolve("10100001.png")).exists();
        assertThat(imageDirectory.resolve("10100001.png.webp")).exists();
        assertThat(imageDirectory.resolve("10100001.png.source"))
                .hasContent("/menu_image/new.png?width=276&q=100");
        verify(menuRepository).saveAll(List.of(regular, decaf));
    }

    @Test
    void unchangedImageSkipsDownloadAndChangedSourceIsDownloadedAgain() throws Exception {
        stubImageResponse();
        TwosomeMenu menu = menu("01");
        service.synchronizeMenus(List.of(menu));
        service.synchronizeMenus(List.of(menu));

        verify(httpClient, times(1)).send(any(HttpRequest.class), any());

        menu.setMenuImg02("/menu_image/changed.png?width=276&q=100");
        service.synchronizeMenus(List.of(menu));

        verify(httpClient, times(2)).send(any(HttpRequest.class), any());
        assertThat(imageDirectory.resolve("10100001.png.source"))
                .hasContent("/menu_image/changed.png?width=276&q=100");
    }

    @Test
    void missingWebpIsRecreatedWithoutDownloadingOriginal() throws Exception {
        Files.write(imageDirectory.resolve("10100001.png"), PNG);
        Files.writeString(imageDirectory.resolve("10100001.png.source"), "/menu_image/new.png?width=276&q=100");
        TwosomeMenu menu = menu("01");
        menu.setLocalImgPath("/images/twosome/10100001.png");

        int synchronizedCount = service.synchronizeMenus(List.of(menu));

        assertThat(synchronizedCount).isEqualTo(1);
        assertThat(imageDirectory.resolve("10100001.png.webp")).exists();
        verify(httpClient, never()).send(any(), any());
        verify(menuRepository, never()).saveAll(any());
    }

    @Test
    void invalidImageDoesNotOverwriteExistingFilesOrAssignLocalPath() throws Exception {
        stubResponse("not an image".getBytes(StandardCharsets.UTF_8));
        Files.write(imageDirectory.resolve("10100001.png"), PNG);
        Files.write(imageDirectory.resolve("10100001.png.webp"), "old-webp".getBytes(StandardCharsets.UTF_8));
        TwosomeMenu menu = menu("01");

        int synchronizedCount = service.synchronizeMenus(List.of(menu));

        assertThat(synchronizedCount).isZero();
        assertThat(menu.getLocalImgPath()).isNull();
        assertThat(imageDirectory.resolve("10100001.png")).hasBinaryContent(PNG);
        assertThat(imageDirectory.resolve("10100001.png.webp")).hasContent("old-webp");
        verify(menuRepository, never()).saveAll(any());
    }

    @Test
    void conversionFailurePreservesExistingOriginalAndWebp() throws Exception {
        stubImageResponse();
        Files.write(imageDirectory.resolve("10100001.png"), PNG);
        Files.write(imageDirectory.resolve("10100001.png.webp"), "old-webp".getBytes(StandardCharsets.UTF_8));
        service = new TwosomeMenuImageService(menuRepository, imageDirectory, httpClient,
                (source, target) -> {
                    throw new IOException("conversion failed");
                });

        int synchronizedCount = service.synchronizeMenus(List.of(menu("01")));

        assertThat(synchronizedCount).isZero();
        assertThat(imageDirectory.resolve("10100001.png")).hasBinaryContent(PNG);
        assertThat(imageDirectory.resolve("10100001.png.webp")).hasContent("old-webp");
        verify(menuRepository, never()).saveAll(any());
    }

    private TwosomeMenu menu(String midCd) {
        TwosomeMenu menu = new TwosomeMenu();
        menu.setMenuCd("10100001");
        menu.setMidCd(midCd);
        menu.setDelYn("N");
        menu.setMenuImg02("/menu_image/new.png?width=276&q=100");
        return menu;
    }

    private void stubImageResponse() throws Exception {
        stubResponse(PNG);
    }

    private void stubResponse(byte[] data) throws Exception {
        org.mockito.Mockito.lenient().when(response.statusCode()).thenReturn(200);
        org.mockito.Mockito.lenient().when(response.headers())
                .thenReturn(java.net.http.HttpHeaders.of(Map.of(), (name, value) -> true));
        doAnswer(invocation -> new ByteArrayInputStream(data)).when(response).body();
        doAnswer(invocation -> response).when(httpClient).send(any(HttpRequest.class), any());
    }
}
