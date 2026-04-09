package com.thesis.smart_resource_planner;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;

/**
 * Entry point for the Smart Resource Planner Spring Boot application.
 * Enables caching and bootstraps all application context components on startup.
 */
@SpringBootApplication
@EnableCaching
public class SmartResourcePlannerApplication {

	/**
	 * Application entry point.
	 * Delegates startup to {@link SpringApplication#run}.
	 *
	 * @param args Command-line arguments passed to the JVM.
	 */
	public static void main(String[] args) {
		SpringApplication.run(SmartResourcePlannerApplication.class, args);
	}

}
