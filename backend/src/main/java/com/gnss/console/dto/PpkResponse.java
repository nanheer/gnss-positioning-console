package com.gnss.console.dto;

import lombok.Data;

@Data
public class PpkResponse {

    private Boolean success;

    private String message;

    private String sessionId;

    private String cmd;

    private String mode;

    private Long elapsedMs;
}