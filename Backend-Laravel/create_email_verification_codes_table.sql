-- Create email_verification_codes table
-- Run this SQL in phpMyAdmin or your MySQL client immediately

USE `sia_app`;

CREATE TABLE IF NOT EXISTS `email_verification_codes` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `email` varchar(191) NOT NULL,
  `code` varchar(6) NOT NULL,
  `expires_at` timestamp NOT NULL,
  `used` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_email` (`email`),
  KEY `idx_email_code_used` (`email`, `code`, `used`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
