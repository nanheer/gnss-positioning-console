package com.gnss.console.service;

import cn.hutool.core.io.FileUtil;
import cn.hutool.core.util.StrUtil;
import com.gnss.console.dto.PpkRequest;
import com.gnss.console.dto.PpkResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.system.ApplicationHome;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;

@Slf4j
@Service
public class PpkService {

    @Value("${solver.exe-path:./position.exe}")
    private String exePath;

    @Value("${solver.temp-dir:./temp}")
    private String tempDir;

    @Value("${solver.timeout:600}")
    private long timeout;

    @Value("${solver.output-file:rover.pos}")
    private String outputFileName;

    public PpkResponse execute(PpkRequest request) {
        PpkResponse response = new PpkResponse();
        String sessionId = generateSessionId();
        Path tempRoot = resolveAppPath(tempDir);
        Path sessionDir = tempRoot.resolve(sessionId);
        long startTime = System.currentTimeMillis();

        try {
            Files.createDirectories(sessionDir);
            log.info("创建会话目录: {}", sessionDir);

            FileInfo files = saveFiles(request.getFiles(), sessionDir);

            if (files.roverFile == null || files.navFile == null) {
                response.setSuccess(false);
                response.setMessage("缺少必要文件：需要至少一个观测文件(.obs)和一个星历文件(.nav)");
                response.setSessionId(sessionId);
                return response;
            }

            String mode = files.baseFile != null ? "PPK" : "SPP";
            response.setMode(mode);

            // 相对路径以 jar 所在目录（后端目录）为基准，避免受启动时工作目录影响
            Path exeFullPath = resolveAppPath(exePath);
            if (exeFullPath == null || !Files.isRegularFile(exeFullPath)) {
                log.error("找不到解算程序: {}", exeFullPath);
                response.setSuccess(false);
                response.setMessage("找不到解算程序 position.exe，请检查配置 solver.exe-path（当前解析为: "
                        + exeFullPath + "）");
                response.setSessionId(sessionId);
                response.setElapsedMs(System.currentTimeMillis() - startTime);
                return response;
            }

            List<String> cmdArgs = buildCommand(files, request, sessionDir, exeFullPath);
            String cmd = String.join(" ", cmdArgs);
            log.info("执行命令: {}", cmd);

            ProcessResult processResult = executeProcess(cmdArgs, sessionDir.toFile());

            response.setSuccess(processResult.exitCode == 0);
            response.setMessage(processResult.exitCode == 0 ? "计算成功" : "计算失败");
            response.setSessionId(sessionId);
            response.setCmd(cmd);
            response.setElapsedMs(System.currentTimeMillis() - startTime);

            // 计算成功后：exe 的输出文件名跟随第一个输入文件（rover.o -> rover.pos，base.o -> base.pos），
            // 这里统一归一化成配置的输出名，保证 /download 一定能取到结果
            if (processResult.exitCode == 0) {
                Path resultFile = locateResultFile(sessionDir, files.roverFile);
                if (resultFile == null) {
                    response.setSuccess(false);
                    response.setMessage("计算结束但未生成 .pos 结果文件");
                } else {
                    Path target = sessionDir.resolve(outputFileName);
                    if (!resultFile.getFileName().toString().equals(outputFileName)) {
                        Files.copy(resultFile, target, StandardCopyOption.REPLACE_EXISTING);
                        log.info("结果文件归一化: {} -> {}", resultFile.getFileName(), outputFileName);
                    }
                }
            }

            log.info("计算完成，sessionId: {}, exitCode: {}, 耗时: {}ms",
                    sessionId, processResult.exitCode, response.getElapsedMs());

        } catch (Exception e) {
            log.error("计算失败", e);
            response.setSuccess(false);
            response.setMessage("计算失败: " + e.getMessage());
            response.setSessionId(sessionId);
            response.setElapsedMs(System.currentTimeMillis() - startTime);
        }

        return response;
    }

    public boolean cleanup(String sessionId) {
        if (StrUtil.isBlank(sessionId)) {
            return false;
        }
        try {
            Path sessionDir = resolveAppPath(tempDir).resolve(sessionId);
            if (Files.exists(sessionDir)) {
                FileUtil.del(sessionDir.toFile());
                log.info("清理会话目录: {}", sessionDir);
                return true;
            }
        } catch (Exception e) {
            log.error("清理失败", e);
        }
        return false;
    }

    public byte[] downloadResult(String sessionId) throws IOException {
        Path sessionDir = resolveAppPath(tempDir).resolve(sessionId);
        Path resultFile = sessionDir.resolve(outputFileName);
        if (Files.exists(resultFile)) {
            return Files.readAllBytes(resultFile);
        }
        // 兜底：配置的输出名不存在时，直接取会话目录里的 .pos
        Path fallback = locateResultFile(sessionDir, null);
        if (fallback != null && Files.exists(fallback)) {
            return Files.readAllBytes(fallback);
        }
        return null;
    }

    /**
     * 解析配置路径：绝对路径原样返回，相对路径以「程序所在目录」为基准。
     * 这样无论从哪个目录启动 java -jar，都能找到 position.exe 和 temp 目录。
     */
    private Path resolveAppPath(String configured) {
        if (StrUtil.isBlank(configured)) {
            return null;
        }
        String value = configured.trim();
        try {
            Path path = Paths.get(value);
            if (path.isAbsolute()) {
                return path.normalize();
            }
        } catch (Exception ignore) {
            // 配置异常时走下面的兜底逻辑
        }
        return appHome().resolve(value).normalize();
    }

    /** 程序所在目录：jar 包所在目录（IDE 运行时为 classes 目录） */
    private static Path appHome() {
        try {
            File dir = new ApplicationHome(PpkService.class).getDir();
            if (dir != null && dir.exists()) {
                return dir.toPath().normalize();
            }
        } catch (Throwable ignore) {
            // 继续尝试下面的方式
        }
        try {
            URL location = PpkService.class.getProtectionDomain().getCodeSource().getLocation();
            if (location != null) {
                String path = location.toString();
                if (path.startsWith("jar:")) {
                    path = path.substring(4);
                }
                int sep = path.indexOf("!/");
                if (sep >= 0) {
                    path = path.substring(0, sep);
                }
                if (path.startsWith("file:")) {
                    path = path.substring(5);
                    // Windows 下形如 /D:/xxx/xxx.jar
                    if (path.length() > 2 && path.charAt(0) == '/' && path.charAt(2) == ':') {
                        path = path.substring(1);
                    }
                }
                Path p = Paths.get(path);
                if (Files.isRegularFile(p)) {
                    return p.getParent().normalize();
                }
                if (Files.isDirectory(p)) {
                    return p.normalize();
                }
            }
        } catch (Throwable ignore) {
            // 忽略，使用兜底目录
        }
        return Paths.get("").toAbsolutePath().normalize();
    }

    /** 定位 exe 实际生成的结果 .pos 文件 */
    private Path locateResultFile(Path sessionDir, String roverFile) {
        // 1) exe 输出规则：第一个输入文件的主名 + .pos（rover.o -> rover.pos）
        if (StrUtil.isNotBlank(roverFile)) {
            int dot = roverFile.lastIndexOf('.');
            String stem = dot > 0 ? roverFile.substring(0, dot) : roverFile;
            Path expected = sessionDir.resolve(stem + ".pos");
            if (Files.exists(expected)) {
                return expected;
            }
        }
        // 2) 配置的输出名
        Path configured = sessionDir.resolve(outputFileName);
        if (Files.exists(configured)) {
            return configured;
        }
        // 3) 会话目录内最新的 .pos
        try (Stream<Path> stream = Files.list(sessionDir)) {
            return stream
                    .filter(p -> p.getFileName().toString().toLowerCase().endsWith(".pos"))
                    .max(Comparator.comparingLong(p -> p.toFile().lastModified()))
                    .orElse(null);
        } catch (IOException e) {
            log.error("查找结果文件失败", e);
            return null;
        }
    }

    private String generateSessionId() {
        return LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"))
                + "_" + UUID.randomUUID().toString().substring(0, 8);
    }

    private FileInfo saveFiles(List<MultipartFile> files, Path sessionDir) throws IOException {
        FileInfo info = new FileInfo();
        for (MultipartFile file : files) {
            String originalFilename = file.getOriginalFilename();
            if (StrUtil.isBlank(originalFilename)) {
                continue;
            }
            Path filePath = sessionDir.resolve(originalFilename);
            file.transferTo(filePath.toFile());
            log.info("保存文件: {}", filePath);

            FileType type = detectFileType(originalFilename);
            if (type == FileType.OBS) {
                if (info.roverFile == null) {
                    info.roverFile = originalFilename;
                } else {
                    info.baseFile = originalFilename;
                }
            } else if (type == FileType.NAV) {
                info.navFile = originalFilename;
            } else {
                if (info.roverFile == null) {
                    info.roverFile = originalFilename;
                } else if (info.baseFile == null) {
                    info.baseFile = originalFilename;
                }
            }
        }
        return info;
    }

    private FileType detectFileType(String filename) {
        String lower = filename.toLowerCase();
        if (lower.endsWith(".obs") || lower.endsWith(".o") ||
                lower.matches(".*\\.\\d{2}[oO]$")) {
            return FileType.OBS;
        }
        if (lower.endsWith(".nav") || lower.endsWith(".n") || lower.endsWith(".c") ||
                lower.endsWith(".rnx") ||
                lower.matches(".*\\.\\d{2}[nNcC]$") ||
                lower.contains("mn.rnx") || lower.contains("_mn.")) {
            return FileType.NAV;
        }
        return FileType.UNKNOWN;
    }

    private List<String> buildCommand(FileInfo files, PpkRequest request, Path sessionDir, Path exeFullPath) {
        List<String> args = new ArrayList<>();

        args.add(exeFullPath.toString());

        if (files.baseFile != null) {
            args.add(files.roverFile);
            args.add(files.baseFile);
            args.add(files.navFile);
        } else {
            args.add(files.roverFile);
            args.add(files.navFile);
        }

        if (request.getCoordX() != null && request.getCoordY() != null && request.getCoordZ() != null) {
            args.add("-c");
            args.add(String.valueOf(request.getCoordX()));
            args.add(String.valueOf(request.getCoordY()));
            args.add(String.valueOf(request.getCoordZ()));
        }

        return args;
    }

    private ProcessResult executeProcess(List<String> cmdArgs, File workingDir)
            throws IOException, InterruptedException {

        ProcessBuilder pb = new ProcessBuilder(cmdArgs);
        pb.directory(workingDir);
        pb.redirectErrorStream(false);
        Process process = pb.start();

        StringBuilder stdout = new StringBuilder();
        StringBuilder stderr = new StringBuilder();

        Thread outThread = new Thread(() -> {
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream(), getCharset()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    stdout.append(line).append("\n");
                    log.debug("STDOUT: {}", line);
                }
            } catch (IOException e) {
                log.error("读取stdout失败", e);
            }
        });

        Thread errThread = new Thread(() -> {
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getErrorStream(), getCharset()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    stderr.append(line).append("\n");
                    log.debug("STDERR: {}", line);
                }
            } catch (IOException e) {
                log.error("读取stderr失败", e);
            }
        });

        outThread.start();
        errThread.start();

        Thread inputThread = new Thread(() -> {
            try {
                OutputStream os = process.getOutputStream();
                int sentCount = 0;
                while (process.isAlive() && sentCount < 30) {
                    Thread.sleep(3000);
                    if (process.isAlive()) {
                        try {
                            os.write("\r\n".getBytes());
                            os.flush();
                            sentCount++;
                            log.debug("发送回车符到stdin，第{}次", sentCount);
                        } catch (IOException e) {
                            log.debug("写入stdin失败: {}", e.getMessage());
                            break;
                        }
                    }
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        });
        inputThread.setDaemon(true);
        inputThread.start();

        boolean finished = process.waitFor(timeout, TimeUnit.SECONDS);
        outThread.join(5000);
        errThread.join(5000);
        inputThread.interrupt();
        inputThread.join(2000);

        if (!finished) {
            process.destroyForcibly();
            throw new RuntimeException("计算超时（超过 " + timeout + " 秒）");
        }

        return new ProcessResult(process.exitValue(), stdout.toString(), stderr.toString());
    }

    private java.nio.charset.Charset getCharset() {
        String os = System.getProperty("os.name").toLowerCase();
        if (os.contains("windows")) {
            return java.nio.charset.Charset.forName("GBK");
        }
        return StandardCharsets.UTF_8;
    }

    @lombok.Data
    private static class FileInfo {
        private String roverFile;
        private String baseFile;
        private String navFile;
    }

    private enum FileType {
        OBS,
        NAV,
        UNKNOWN
    }

    @lombok.AllArgsConstructor
    @lombok.Getter
    private static class ProcessResult {
        private final int exitCode;
        private final String stdout;
        private final String stderr;
    }
}
