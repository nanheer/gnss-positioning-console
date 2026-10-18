package com.gnss.console;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class GnssConsoleApplication {

    public static void main(String[] args) {
        SpringApplication.run(GnssConsoleApplication.class, args);
        System.out.println("=== GNSS Solver Service Started ===");
        System.out.println("API地址: http://localhost:8080/api/solver/solve");
    }
}
