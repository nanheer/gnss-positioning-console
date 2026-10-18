package com.gnss.console.dto;

import lombok.Data;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Data
public class PpkRequest {

    private List<MultipartFile> files;

    private Double coordX;

    private Double coordY;

    private Double coordZ;

    private String coordType = "auto";

    private Double threshold;
}
