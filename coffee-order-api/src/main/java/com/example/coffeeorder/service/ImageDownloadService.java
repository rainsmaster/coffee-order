package com.example.coffeeorder.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.Duration;

@Slf4j
@Service
public class ImageDownloadService {

    private static final String TWOSOME_CDN_BASE_URL = "https://mcdn.twosome.co.kr";
    private static final String IMAGE_SUB_DIR = "images/twosome";

    @Value("${app.data.path:./data}")
    private String dataPath;

    private final HttpClient httpClient;

    public ImageDownloadService() {
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    /**
     * 투썸 메뉴 이미지를 다운로드하여 로컬에 저장
     * @param menuCd 메뉴 코드
     * @param imageUrl 이미지 URL (상대 경로 또는 전체 경로)
     * @return 저장된 로컬 경로 (예: /images/twosome/10100001.jpg) 또는 실패 시 null
     */
    public String downloadAndSaveImage(String menuCd, String imageUrl) {
        if (imageUrl == null || imageUrl.isBlank()) {
            log.warn("Image URL is empty for menu: {}", menuCd);
            return null;
        }

        try {
            // 이미지 저장 디렉토리 생성
            Path imageDir = Paths.get(dataPath, IMAGE_SUB_DIR);
            Files.createDirectories(imageDir);

            // 전체 URL 구성
            String fullUrl = imageUrl.startsWith("http") ? imageUrl : TWOSOME_CDN_BASE_URL + imageUrl;

            // 파일 확장자 추출
            String extension = extractExtension(imageUrl);
            String fileName = menuCd + extension;
            Path targetPath = imageDir.resolve(fileName);

            // 이미지 다운로드
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(fullUrl))
                    .timeout(Duration.ofSeconds(30))
                    .header("User-Agent", "Mozilla/5.0")
                    .GET()
                    .build();

            HttpResponse<InputStream> response = httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());

            if (response.statusCode() == 200) {
                try (InputStream inputStream = response.body()) {
                    Files.copy(inputStream, targetPath, StandardCopyOption.REPLACE_EXISTING);
                }

                String localPath = "/" + IMAGE_SUB_DIR + "/" + fileName;
                log.debug("Image saved: {} -> {}", menuCd, localPath);
                return localPath;
            } else {
                log.warn("Failed to download image for menu {}: HTTP {}", menuCd, response.statusCode());
                return null;
            }

        } catch (IOException | InterruptedException e) {
            log.error("Error downloading image for menu {}: {}", menuCd, e.getMessage());
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            return null;
        }
    }

    /**
     * URL에서 파일 확장자 추출
     */
    private String extractExtension(String url) {
        // 쿼리스트링 제거
        String path = url.split("\\?")[0];

        int lastDot = path.lastIndexOf('.');
        if (lastDot > 0 && lastDot < path.length() - 1) {
            String ext = path.substring(lastDot).toLowerCase();
            // 유효한 이미지 확장자만 허용
            if (ext.matches("\\.(jpg|jpeg|png|gif|webp)")) {
                return ext;
            }
        }
        return ".jpg"; // 기본 확장자
    }

    /**
     * 이미지 디렉토리 경로 반환
     */
    public Path getImageDirectory() {
        return Paths.get(dataPath, IMAGE_SUB_DIR);
    }

    /**
     * 특정 메뉴의 로컬 이미지 파일 존재 여부 확인
     */
    public boolean imageExists(String menuCd) {
        Path imageDir = Paths.get(dataPath, IMAGE_SUB_DIR);
        // jpg, png 등 다양한 확장자 확인
        for (String ext : new String[]{".jpg", ".jpeg", ".png", ".gif", ".webp"}) {
            if (Files.exists(imageDir.resolve(menuCd + ext))) {
                return true;
            }
        }
        return false;
    }
}
