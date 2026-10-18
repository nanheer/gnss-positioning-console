package com.gnss.console.controller;

import com.gnss.console.dto.PpkRequest;
import com.gnss.console.dto.PpkResponse;
import com.gnss.console.service.PpkService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/solver")
@RequiredArgsConstructor
public class PpkController {

    private final PpkService ppkService;

    @PostMapping(value = "/solve", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<PpkResponse> solve(
            @RequestPart("files") List<MultipartFile> files,
            @RequestParam(value = "coordX", required = false) Double coordX,
            @RequestParam(value = "coordY", required = false) Double coordY,
            @RequestParam(value = "coordZ", required = false) Double coordZ,
            @RequestParam(value = "coordType", defaultValue = "auto") String coordType,
            @RequestParam(value = "threshold", required = false) Double threshold) {

        log.info("收到计算请求，文件数: {}, coordType: {}", files.size(), coordType);

        PpkRequest request = new PpkRequest();
        request.setFiles(files);
        request.setCoordX(coordX);
        request.setCoordY(coordY);
        request.setCoordZ(coordZ);
        request.setCoordType(coordType);
        request.setThreshold(threshold);

        PpkResponse response = ppkService.execute(request);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/cleanup/{sessionId}")
    public ResponseEntity<Void> cleanup(@PathVariable String sessionId) {
        log.info("清理会话: {}", sessionId);
        boolean success = ppkService.cleanup(sessionId);
        return success ? ResponseEntity.ok().build() : ResponseEntity.notFound().build();
    }

    @GetMapping("/download/{sessionId}")
    public ResponseEntity<byte[]> download(@PathVariable String sessionId) {
        try {
            byte[] data = ppkService.downloadResult(sessionId);
            if (data != null) {
                return ResponseEntity.ok()
                        .header(HttpHeaders.CONTENT_DISPOSITION,
                                "attachment; filename=\"" + sessionId + ".pos\"")
                        .contentType(MediaType.TEXT_PLAIN)
                        .body(data);
            }
        } catch (Exception e) {
            log.error("下载失败", e);
        }
        return ResponseEntity.notFound().build();
    }

    @GetMapping("/health")
    public ResponseEntity<String> health() {
        return ResponseEntity.ok("OK");
    }
}
