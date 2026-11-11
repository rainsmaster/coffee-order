package com.example.coffeeorder.service;

import com.example.coffeeorder.entity.TwosomeMenu;
import com.example.coffeeorder.repository.TwosomeMenuRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
public class TwosomeMenuImageService {

    private static final String CDN_BASE_URL = "https://mcdn.twosome.co.kr";
    private static final String LOCAL_IMAGE_PREFIX = "/images/twosome/";
    private static final int MAX_IMAGE_BYTES = 5 * 1024 * 1024;

    private final TwosomeMenuRepository menuRepository;
    private final Path imageDirectory;
    private final HttpClient httpClient;
    private final ImageConverter imageConverter;

    @Autowired
    public TwosomeMenuImageService(
            TwosomeMenuRepository menuRepository,
            @Value("${twosome.images.directory:data/images/twosome}") String imageDirectory,
            @Value("${twosome.images.converter-command:cwebp}") String converterCommand) {
        this(menuRepository, Path.of(imageDirectory),
                HttpClient.newBuilder()
                        .connectTimeout(Duration.ofSeconds(5))
                        .followRedirects(HttpClient.Redirect.NORMAL)
                        .build(),
                new ProcessImageConverter(converterCommand));
    }

    TwosomeMenuImageService(TwosomeMenuRepository menuRepository, Path imageDirectory,
                            HttpClient httpClient, ImageConverter imageConverter) {
        this.menuRepository = menuRepository;
        this.imageDirectory = imageDirectory;
        this.httpClient = httpClient;
        this.imageConverter = imageConverter;
    }

    public synchronized int synchronizeMenus(List<TwosomeMenu> menus) {
        Map<String, List<TwosomeMenu>> menusByCode = new LinkedHashMap<>();
        for (TwosomeMenu menu : menus) {
            if (menu.getMenuCd() != null && menu.getMenuCd().matches("[A-Za-z0-9_-]+")
                    && !"Y".equals(menu.getDelYn())) {
                menusByCode.computeIfAbsent(menu.getMenuCd(), key -> new ArrayList<>()).add(menu);
            }
        }

        int synchronizedCount = 0;
        for (Map.Entry<String, List<TwosomeMenu>> entry : menusByCode.entrySet()) {
            try {
                if (synchronizeMenuGroup(entry.getKey(), entry.getValue())) {
                    synchronizedCount++;
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                log.warn("Twosome menu image synchronization interrupted (menuCd={})", entry.getKey());
                break;
            } catch (Exception e) {
                log.warn("Failed to synchronize menu image (menuCd={}): {}", entry.getKey(), e.getMessage());
            }
        }
        return synchronizedCount;
    }

    private boolean synchronizeMenuGroup(String menuCd, List<TwosomeMenu> menus) throws Exception {
        Files.createDirectories(imageDirectory);
        TwosomeMenu sourceMenu = menus.stream()
                .filter(menu -> remotePath(menu) != null)
                .findFirst()
                .orElse(menus.get(0));
        String remotePath = remotePath(sourceMenu);
        String extension = extensionOf(remotePath);
        String fileName = extension != null ? menuCd + extension : existingFileName(menus);
        if (fileName == null) {
            return false;
        }

        Path original = imageDirectory.resolve(fileName).normalize();
        if (!original.startsWith(imageDirectory.normalize())) {
            return false;
        }
        Path webp = original.resolveSibling(original.getFileName() + ".webp");
        Path sourceMarker = original.resolveSibling(original.getFileName() + ".source");
        boolean sourceChanged = !Objects.equals(readSource(sourceMarker), remotePath == null ? "" : remotePath);
        List<Path> temporaryFiles = new ArrayList<>();
        try {
            if (sourceChanged || !Files.isRegularFile(original)) {
                if (remotePath == null) {
                    if (!Files.isRegularFile(original)) {
                        return false;
                    }
                } else {
                    Path downloaded = temporaryFile(original, temporaryFiles);
                    Path converted = temporaryFile(webp, temporaryFiles);
                    Files.write(downloaded, download(remotePath));
                    imageConverter.convert(downloaded, converted);
                    if (!Files.isRegularFile(converted) || Files.size(converted) == 0) {
                        throw new IOException("WebP conversion produced no output");
                    }
                    replace(downloaded, original);
                    replace(converted, webp);
                }
            } else if (!Files.isRegularFile(webp)) {
                Path converted = temporaryFile(webp, temporaryFiles);
                imageConverter.convert(original, converted);
                replace(converted, webp);
            }

            if (!Files.isRegularFile(original) || !Files.isRegularFile(webp)) {
                return false;
            }
            if (sourceChanged) {
                Files.writeString(sourceMarker, remotePath == null ? "" : remotePath, StandardCharsets.UTF_8);
            }

            List<TwosomeMenu> changedMenus = new ArrayList<>();
            String localPath = LOCAL_IMAGE_PREFIX + fileName;
            for (TwosomeMenu menu : menus) {
                if (!localPath.equals(menu.getLocalImgPath())) {
                    menu.setLocalImgPath(localPath);
                    changedMenus.add(menu);
                }
            }
            if (!changedMenus.isEmpty()) {
                menuRepository.saveAll(changedMenus);
            }
            return true;
        } finally {
            for (Path temporaryFile : temporaryFiles) {
                Files.deleteIfExists(temporaryFile);
            }
        }
    }

    private byte[] download(String remotePath) throws IOException, InterruptedException {
        URI uri = URI.create(CDN_BASE_URL + remotePath);
        HttpRequest request = HttpRequest.newBuilder(uri)
                .timeout(Duration.ofSeconds(15))
                .header("Accept", "image/png,image/jpeg")
                .header("User-Agent", "Mozilla/5.0 (compatible; CoffeeOrderImageSync/1.0)")
                .GET()
                .build();
        HttpResponse<InputStream> response = httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());
        try (InputStream body = response.body()) {
            if (response.statusCode() != 200) {
                throw new IOException("Image download returned HTTP " + response.statusCode());
            }
            if (response.headers().firstValueAsLong("Content-Length").orElse(0) > MAX_IMAGE_BYTES) {
                throw new IOException("Image exceeds the size limit");
            }
            byte[] data = body.readNBytes(MAX_IMAGE_BYTES + 1);
            if (data.length == 0 || data.length > MAX_IMAGE_BYTES || !isJpegOrPng(data)) {
                throw new IOException("Image response is not a valid JPEG or PNG");
            }
            return data;
        }
    }

    private String remotePath(TwosomeMenu menu) {
        String path = menu.getMenuImg02() != null && !menu.getMenuImg02().isBlank()
                ? menu.getMenuImg02() : menu.getMenuImg();
        if (path == null || !path.startsWith("/") || path.contains("..")) {
            return null;
        }
        return path;
    }

    private String extensionOf(String remotePath) {
        if (remotePath == null) {
            return null;
        }
        String cleanPath = remotePath.split("[?#]", 2)[0];
        int extensionIndex = cleanPath.lastIndexOf('.');
        if (extensionIndex < 0) {
            return null;
        }
        String extension = cleanPath.substring(extensionIndex).toLowerCase();
        return extension.equals(".jpg") || extension.equals(".jpeg") || extension.equals(".png")
                ? extension : null;
    }

    private String existingFileName(List<TwosomeMenu> menus) {
        for (TwosomeMenu menu : menus) {
            String path = menu.getLocalImgPath();
            if (path != null && path.startsWith(LOCAL_IMAGE_PREFIX)) {
                String fileName = path.substring(LOCAL_IMAGE_PREFIX.length());
                if (fileName.matches("[A-Za-z0-9_-]+\\.(jpg|jpeg|png)")) {
                    return fileName;
                }
            }
        }
        return null;
    }

    private String readSource(Path sourceMarker) throws IOException {
        return Files.isRegularFile(sourceMarker) ? Files.readString(sourceMarker, StandardCharsets.UTF_8) : null;
    }

    private Path temporaryFile(Path target, List<Path> temporaryFiles) {
        Path temporary = target.resolveSibling("." + target.getFileName() + "." + UUID.randomUUID() + ".tmp");
        temporaryFiles.add(temporary);
        return temporary;
    }

    private void replace(Path source, Path target) throws IOException {
        try {
            Files.move(source, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } catch (AtomicMoveNotSupportedException e) {
            Files.move(source, target, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    private boolean isJpegOrPng(byte[] data) {
        boolean jpeg = data.length >= 3
                && (data[0] & 0xff) == 0xff && (data[1] & 0xff) == 0xd8 && (data[2] & 0xff) == 0xff;
        byte[] pngSignature = {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'};
        boolean png = data.length >= pngSignature.length;
        for (int i = 0; png && i < pngSignature.length; i++) {
            png = data[i] == pngSignature[i];
        }
        return jpeg || png;
    }

    interface ImageConverter {
        void convert(Path source, Path target) throws IOException, InterruptedException;
    }

    private static class ProcessImageConverter implements ImageConverter {
        private final String command;

        private ProcessImageConverter(String command) {
            this.command = command;
        }

        @Override
        public void convert(Path source, Path target) throws IOException, InterruptedException {
            Process process = new ProcessBuilder(command, "-quiet", "-q", "82", "-mt",
                    source.toString(), "-o", target.toString())
                    .redirectOutput(ProcessBuilder.Redirect.DISCARD)
                    .redirectError(ProcessBuilder.Redirect.DISCARD)
                    .start();
            if (!process.waitFor(30, TimeUnit.SECONDS)) {
                process.destroyForcibly();
                process.waitFor(5, TimeUnit.SECONDS);
                throw new IOException("WebP conversion timed out");
            }
            if (process.exitValue() != 0) {
                throw new IOException("WebP conversion failed with exit code " + process.exitValue());
            }
        }
    }
}
