-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Feb 17, 2026 at 07:58 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

--
-- Database: `sia_app`
--

DELIMITER $$
--
-- Functions
--
CREATE DEFINER=`root`@`localhost` FUNCTION `generate_student_number` () RETURNS VARCHAR(50) CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci DETERMINISTIC READS SQL DATA BEGIN
    DECLARE next_num INT;
    SELECT COALESCE(MAX(CAST(SUBSTRING(student_number, 2) AS UNSIGNED)), 0) + 1 
    INTO next_num 
    FROM student_profiles 
    WHERE student_number LIKE 'S%';
    RETURN CONCAT('S', LPAD(next_num, 7, '0'));
END$$

CREATE DEFINER=`root`@`localhost` FUNCTION `generate_teacher_number` () RETURNS VARCHAR(50) CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci DETERMINISTIC READS SQL DATA BEGIN
    DECLARE next_num INT;
    SELECT COALESCE(MAX(CAST(SUBSTRING(teacher_number, 3) AS UNSIGNED)), 0) + 1 
    INTO next_num 
    FROM teacher_profiles 
    WHERE teacher_number LIKE 'T-%';
    RETURN CONCAT('T-', LPAD(next_num, 4, '0'));
END$$

CREATE DEFINER=`root`@`localhost` FUNCTION `user_dashboard_path` (`p_email` VARCHAR(191)) RETURNS VARCHAR(64) CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci DETERMINISTIC BEGIN
  DECLARE v_role VARCHAR(50);
  SELECT r.name INTO v_role
    FROM users u 
    JOIN roles r ON r.id = u.role_id
   WHERE u.email = p_email
   LIMIT 1;
  RETURN CASE v_role
    WHEN 'student' THEN '/student/dashboard'
    WHEN 'teacher' THEN '/teacher/dashboard'
    WHEN 'admin'   THEN '/admin/dashboard'
    ELSE '/login'
  END;
END$$

DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `admin_profiles`
--

CREATE TABLE `admin_profiles` (
  `user_id` int(10) UNSIGNED NOT NULL,
  `position` varchar(100) DEFAULT 'System Administrator',
  `permissions` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`permissions`)),
  `status` enum('active','inactive') DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `admin_profiles`
--

INSERT INTO `admin_profiles` (`user_id`, `position`, `permissions`, `status`, `created_at`, `updated_at`) VALUES
(1, 'Super Administrator', '{\"manage_users\": true, \"manage_courses\": true, \"manage_system\": true, \"view_reports\": true}', 'active', '2025-10-16 05:19:11', '2025-10-16 05:19:11');

-- --------------------------------------------------------

--
-- Table structure for table `attendance_logs`
--

CREATE TABLE `attendance_logs` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `subject_id` int(10) UNSIGNED NOT NULL,
  `student_id` int(10) UNSIGNED NOT NULL,
  `teacher_user_id` int(10) UNSIGNED DEFAULT NULL,
  `status` enum('present','late','absent') NOT NULL DEFAULT 'present',
  `attendance_date` date NOT NULL,
  `scanned_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `browser_activities`
--

CREATE TABLE `browser_activities` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `student_user_id` int(10) UNSIGNED NOT NULL,
  `url` text NOT NULL,
  `page_title` varchar(500) DEFAULT NULL,
  `visit_timestamp` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `duration_seconds` int(11) DEFAULT NULL,
  `tab_id` varchar(50) DEFAULT NULL,
  `is_incognito` tinyint(1) NOT NULL DEFAULT 0,
  `session_id` bigint(20) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `browser_activities`
--

INSERT INTO `browser_activities` (`id`, `student_user_id`, `url`, `page_title`, `visit_timestamp`, `duration_seconds`, `tab_id`, `is_incognito`, `session_id`, `created_at`, `updated_at`) VALUES
(1585, 38, 'http://localhost/phpmyadmin/index.php?route=/sql&pos=0&db=sia_app&table=browser_activities', 'localhost / 127.0.0.1 / sia_app / browser_activities | phpMyAdmin 5.2.1', '2026-02-12 22:41:43', NULL, '602570674', 0, 17, '2026-02-12 22:41:44', '2026-02-12 22:41:44'),
(1586, 38, 'http://localhost/phpmyadmin/index.php?route=/sql&pos=0&db=sia_app&table=browser_activities', 'localhost / 127.0.0.1 / sia_app / browser_activities | phpMyAdmin 5.2.1', '2026-02-12 22:41:44', NULL, '602570674', 0, 17, '2026-02-12 22:41:44', '2026-02-12 22:41:44'),
(1587, 38, 'http://localhost/phpmyadmin/index.php?route=/sql&pos=0&db=sia_app&table=browser_activities', 'localhost / 127.0.0.1 / sia_app / browser_activities | phpMyAdmin 5.2.1', '2026-02-12 22:41:49', NULL, '602570674', 0, 17, '2026-02-12 22:41:50', '2026-02-12 22:41:50'),
(1588, 38, 'http://localhost/phpmyadmin/index.php?route=/sql&pos=0&db=sia_app&table=browser_activities', 'localhost / 127.0.0.1 / sia_app / browser_activities | phpMyAdmin 5.2.1', '2026-02-12 22:41:53', NULL, '602570674', 0, 17, '2026-02-12 22:41:56', '2026-02-12 22:41:56'),
(1589, 38, 'http://localhost/phpmyadmin/index.php?route=/sql&pos=0&db=sia_app&table=email_verification_codes', 'localhost / 127.0.0.1 / sia_app / browser_activities | phpMyAdmin 5.2.1', '2026-02-12 22:41:56', NULL, '602570674', 0, 17, '2026-02-12 22:41:58', '2026-02-12 22:41:58'),
(1590, 38, 'http://localhost/phpmyadmin/index.php?route=/sql&pos=0&db=sia_app&table=email_verification_codes', 'localhost / 127.0.0.1 / sia_app / email_verification_codes | phpMyAdmin 5.2.1', '2026-02-12 22:41:57', NULL, '602570674', 0, 17, '2026-02-12 22:41:58', '2026-02-12 22:41:58'),
(1591, 38, 'http://localhost/phpmyadmin/index.php?route=/sql&pos=0&db=sia_app&table=email_verification_codes', 'localhost / 127.0.0.1 / sia_app / email_verification_codes | phpMyAdmin 5.2.1', '2026-02-12 22:42:02', NULL, '602570674', 0, 17, '2026-02-12 22:42:03', '2026-02-12 22:42:03'),
(1592, 38, 'http://localhost/phpmyadmin/index.php?route=/sql&pos=0&db=sia_app&table=email_verification_codes', 'localhost / 127.0.0.1 / sia_app / email_verification_codes | phpMyAdmin 5.2.1', '2026-02-12 22:42:05', NULL, '602570674', 0, 17, '2026-02-12 22:42:06', '2026-02-12 22:42:06'),
(1593, 38, 'http://localhost:3000/teacher/dashboard', 'Sia Web', '2026-02-12 22:42:08', NULL, '602570652', 0, 17, '2026-02-12 22:42:10', '2026-02-12 22:42:10'),
(1594, 38, 'http://localhost:3000/teacher/dashboard', 'Sia Web', '2026-02-12 23:02:30', NULL, '602570652', 0, 18, '2026-02-12 23:02:32', '2026-02-12 23:02:32'),
(1595, 38, 'http://localhost:3000/teacher/dashboard', 'Sia Web', '2026-02-12 23:02:30', NULL, '602570652', 0, 18, '2026-02-12 23:02:33', '2026-02-12 23:02:33'),
(1597, 38, 'https://www.youtube.com/', 'YouTube', '2026-02-12 23:03:10', NULL, '602570675', 0, 18, '2026-02-12 23:03:12', '2026-02-12 23:03:12'),
(1598, 38, 'http://localhost:3000/teacher/dashboard', 'Sia Web', '2026-02-12 23:03:11', NULL, '602570652', 0, 18, '2026-02-12 23:03:13', '2026-02-12 23:03:13'),
(1599, 38, 'FORCE_CLOSE_TAB_COMMAND', 'https://www.youtube.com/', '2026-02-12 23:03:39', NULL, NULL, 0, NULL, '2026-02-12 23:03:39', '2026-02-12 23:03:39');

-- --------------------------------------------------------

--
-- Table structure for table `bscs_students`
--

CREATE TABLE `bscs_students` (
  `user_id` int(10) UNSIGNED NOT NULL,
  `email` varchar(191) NOT NULL,
  `full_name` varchar(191) NOT NULL,
  `student_number` varchar(50) NOT NULL,
  `section` varchar(50) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `bsemc_students`
--

CREATE TABLE `bsemc_students` (
  `user_id` int(10) UNSIGNED NOT NULL,
  `email` varchar(191) NOT NULL,
  `full_name` varchar(191) NOT NULL,
  `student_number` varchar(50) NOT NULL,
  `section` varchar(50) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `bsemc_students`
--

INSERT INTO `bsemc_students` (`user_id`, `email`, `full_name`, `student_number`, `section`, `created_at`, `updated_at`) VALUES
(32, 'student1@gmail.com', 'Marquez B. Dizon', '01334567122', 'BSIT 3-Y2-2', '2026-01-15 18:01:05', '2026-01-15 18:01:05');

-- --------------------------------------------------------

--
-- Table structure for table `bsit_students`
--

CREATE TABLE `bsit_students` (
  `user_id` int(10) UNSIGNED NOT NULL,
  `email` varchar(191) NOT NULL,
  `full_name` varchar(191) NOT NULL,
  `student_number` varchar(50) NOT NULL,
  `section` varchar(50) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `bsit_students`
--

INSERT INTO `bsit_students` (`user_id`, `email`, `full_name`, `student_number`, `section`, `created_at`, `updated_at`) VALUES
(38, 'kaylepedroza@gmail.com', 'Kayle D. Ped', '01223777150', 'BSIT 3-Y2-2', '2026-02-04 18:46:20', '2026-02-04 18:46:20');

-- --------------------------------------------------------

--
-- Table structure for table `course_sections`
--

CREATE TABLE `course_sections` (
  `id` int(10) UNSIGNED NOT NULL,
  `course` enum('BSIT','BSCS','BSEMC') NOT NULL,
  `section` varchar(50) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `email_verification_codes`
--

CREATE TABLE `email_verification_codes` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `email` varchar(255) NOT NULL,
  `code` varchar(6) NOT NULL,
  `used` tinyint(1) DEFAULT 0,
  `expires_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `email_verification_codes`
--

INSERT INTO `email_verification_codes` (`id`, `email`, `code`, `used`, `expires_at`, `created_at`, `updated_at`) VALUES
(45, 'kaylepedroza@gmail.com', '959207', 1, '2026-02-13 06:43:47', '2026-02-12 22:43:18', '2026-02-12 22:43:47'),
(46, 'kaylepedroza@gmail.com', '040087', 1, '2026-02-13 06:59:48', '2026-02-12 22:59:29', '2026-02-12 22:59:48'),
(47, 'kaylepedroza@gmail.com', '325594', 1, '2026-02-13 07:01:36', '2026-02-12 23:01:14', '2026-02-12 23:01:36');

-- --------------------------------------------------------

--
-- Table structure for table `incognito_alerts`
--

CREATE TABLE `incognito_alerts` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `student_user_id` int(10) UNSIGNED NOT NULL,
  `detected_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `session_id` bigint(20) UNSIGNED DEFAULT NULL,
  `is_acknowledged` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `master_subjects`
--

CREATE TABLE `master_subjects` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `code` varchar(32) NOT NULL,
  `name` varchar(191) NOT NULL,
  `description` text DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `master_subjects`
--

INSERT INTO `master_subjects` (`id`, `code`, `name`, `description`, `is_active`, `created_at`, `updated_at`) VALUES
(1, '312', 'IPTC', NULL, 1, '2026-01-20 19:40:29', '2026-01-20 19:40:29');

-- --------------------------------------------------------

--
-- Table structure for table `migrations`
--

CREATE TABLE `migrations` (
  `id` int(10) UNSIGNED NOT NULL,
  `migration` varchar(255) NOT NULL,
  `batch` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `migrations`
--

INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES
(1, '2025_01_01_000000_add_profile_picture_to_student_profiles_table', 1),
(3, '2025_11_16_190848_add_profile_picture_to_teacher_profiles_table', 2),
(4, '2026_01_19_000000_create_monitoring_sessions_table', 3),
(5, '2026_01_19_000001_create_browser_activities_table', 4),
(6, '2026_01_19_000002_create_incognito_alerts_table', 5);

-- --------------------------------------------------------

--
-- Table structure for table `monitoring_sessions`
--

CREATE TABLE `monitoring_sessions` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `student_user_id` int(10) UNSIGNED NOT NULL,
  `session_start` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `session_end` timestamp NULL DEFAULT NULL,
  `device_info` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`device_info`)),
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `session_name` varchar(255) DEFAULT NULL,
  `created_by` int(10) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `monitoring_sessions`
--

INSERT INTO `monitoring_sessions` (`id`, `student_user_id`, `session_start`, `session_end`, `device_info`, `is_active`, `session_name`, `created_by`, `created_at`, `updated_at`) VALUES
(7, 38, '2026-02-07 05:12:25', '2026-02-06 21:12:25', NULL, 0, 'Auto-started Session', 38, '2026-02-06 11:26:13', '2026-02-06 21:12:25'),
(8, 38, '2026-02-08 02:23:18', '2026-02-07 18:23:18', NULL, 0, 'Auto-started Session', 38, '2026-02-07 18:22:21', '2026-02-07 18:23:18'),
(9, 38, '2026-02-08 13:29:29', '2026-02-08 05:29:29', NULL, 0, 'Auto-started Session', 38, '2026-02-07 18:23:22', '2026-02-08 05:29:29'),
(10, 38, '2026-02-09 14:45:39', '2026-02-09 06:45:39', NULL, 0, 'Auto-started Session', 38, '2026-02-08 06:16:20', '2026-02-09 06:45:39'),
(11, 38, '2026-02-09 17:02:22', '2026-02-09 09:02:22', NULL, 0, 'Auto-started Session', 38, '2026-02-09 09:00:44', '2026-02-09 09:02:22'),
(12, 38, '2026-02-09 17:10:55', '2026-02-09 09:10:55', NULL, 0, 'Auto-started Session', 38, '2026-02-09 09:08:45', '2026-02-09 09:10:55'),
(13, 38, '2026-02-09 17:20:26', '2026-02-09 09:20:26', NULL, 0, 'Auto-started Session', 38, '2026-02-09 09:11:04', '2026-02-09 09:20:26'),
(14, 38, '2026-02-09 17:26:25', '2026-02-09 09:26:25', NULL, 0, 'Auto-started Session', 38, '2026-02-09 09:20:28', '2026-02-09 09:26:25'),
(15, 38, '2026-02-11 18:48:18', '2026-02-11 10:48:18', NULL, 0, 'Auto-started Session', 38, '2026-02-11 10:46:29', '2026-02-11 10:48:18'),
(16, 38, '2026-02-13 04:44:51', '2026-02-12 20:44:51', NULL, 0, 'Auto-started Session', 38, '2026-02-11 10:48:19', '2026-02-12 20:44:51'),
(17, 38, '2026-02-13 06:44:18', '2026-02-12 22:44:18', NULL, 0, 'Auto-started Session', 38, '2026-02-12 20:44:55', '2026-02-12 22:44:18'),
(18, 38, '2026-02-13 09:18:59', NULL, NULL, 1, 'Auto-started Session', 38, '2026-02-12 23:02:22', '2026-02-13 01:18:59');

-- --------------------------------------------------------

--
-- Table structure for table `personal_access_tokens`
--

CREATE TABLE `personal_access_tokens` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `tokenable_type` varchar(255) NOT NULL,
  `tokenable_id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `token` varchar(64) NOT NULL,
  `abilities` text DEFAULT NULL,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `personal_access_tokens`
--

INSERT INTO `personal_access_tokens` (`id`, `tokenable_type`, `tokenable_id`, `name`, `token`, `abilities`, `last_used_at`, `expires_at`, `created_at`, `updated_at`) VALUES
(69, 'App\\Models\\User', 1, 'web', '9d09bfc2d0b60b7292cb5eacc361189d95e2f9ed10f23c72ff0e868706a375b2', '[\"*\"]', '2026-02-12 20:37:16', NULL, '2026-02-12 20:36:36', '2026-02-12 20:37:16'),
(73, 'App\\Models\\User', 34, 'web', '0e5a9d89da05c38c5dd8349994461c76a35927a5acb2e065dd636946b1f8fa42', '[\"*\"]', '2026-02-13 01:18:49', NULL, '2026-02-12 22:26:27', '2026-02-13 01:18:49'),
(80, 'App\\Models\\User', 38, 'web', '5532c06823040fef0fed67b17a51892792091b688fd234deec788fdd068905a8', '[\"*\"]', '2026-02-13 01:18:59', NULL, '2026-02-12 23:02:21', '2026-02-13 01:18:59');

-- --------------------------------------------------------

--
-- Table structure for table `student_barcodes`
--

CREATE TABLE `student_barcodes` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `barcode` varchar(191) NOT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `used` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `student_pins`
--

CREATE TABLE `student_pins` (
  `user_id` int(10) UNSIGNED NOT NULL,
  `pin_hash` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `student_profiles`
--

CREATE TABLE `student_profiles` (
  `user_id` int(10) UNSIGNED NOT NULL,
  `student_number` varchar(50) NOT NULL,
  `course` varchar(100) DEFAULT NULL,
  `year_level` tinyint(3) UNSIGNED DEFAULT NULL,
  `section` varchar(50) DEFAULT NULL,
  `profile_picture` longtext DEFAULT NULL,
  `pin` varchar(255) DEFAULT NULL,
  `status` enum('active','inactive','suspended','graduated') DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `student_profiles`
--

INSERT INTO `student_profiles` (`user_id`, `student_number`, `course`, `year_level`, `section`, `profile_picture`, `pin`, `status`, `created_at`, `updated_at`) VALUES
(32, '01334567122', 'BSEMC', NULL, 'BSIT 3-Y2-2', NULL, NULL, 'active', '2026-01-15 06:53:35', '2026-01-15 10:01:05'),
(38, '01223777150', 'BSIT', NULL, 'BSIT 3-Y2-2', NULL, '$2y$12$A6KtLT1dpJle2thqF38qKuVLomkx8My2mG.bbQQUBwKmkTbnBvis6', 'active', '2026-02-04 10:46:20', '2026-02-04 11:28:07');

--
-- Triggers `student_profiles`
--
DELIMITER $$
CREATE TRIGGER `student_profiles_ai_route` AFTER INSERT ON `student_profiles` FOR EACH ROW BEGIN
  DECLARE v_course VARCHAR(100);
  SET v_course = UPPER(COALESCE(NEW.course, ''));

  -- First, clean from all course tables (in case of re-insert scenarios)
  DELETE FROM bsit_students  WHERE user_id = NEW.user_id;
  DELETE FROM bscs_students  WHERE user_id = NEW.user_id;
  DELETE FROM bsemc_students WHERE user_id = NEW.user_id;

  IF v_course = 'BSIT' THEN
    INSERT INTO bsit_students (user_id, email, full_name, student_number, section, created_at, updated_at)
    SELECT u.id, u.email, u.full_name, NEW.student_number, NEW.section, NOW(), NOW()
    FROM users u WHERE u.id = NEW.user_id;
  ELSEIF v_course = 'BSCS' THEN
    INSERT INTO bscs_students (user_id, email, full_name, student_number, section, created_at, updated_at)
    SELECT u.id, u.email, u.full_name, NEW.student_number, NEW.section, NOW(), NOW()
    FROM users u WHERE u.id = NEW.user_id;
  ELSEIF v_course = 'BSEMC' THEN
    INSERT INTO bsemc_students (user_id, email, full_name, student_number, section, created_at, updated_at)
    SELECT u.id, u.email, u.full_name, NEW.student_number, NEW.section, NOW(), NOW()
    FROM users u WHERE u.id = NEW.user_id;
  END IF;
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `student_profiles_au_route` AFTER UPDATE ON `student_profiles` FOR EACH ROW BEGIN
  DECLARE v_course_old VARCHAR(100);
  DECLARE v_course_new VARCHAR(100);
  SET v_course_old = UPPER(COALESCE(OLD.course, ''));
  SET v_course_new = UPPER(COALESCE(NEW.course, ''));

  -- If course changed or student_number/section changed, re-sync
  IF v_course_old <> v_course_new
     OR OLD.student_number <> NEW.student_number
     OR IFNULL(OLD.section,'') <> IFNULL(NEW.section,'') THEN

    -- Remove from all tables
    DELETE FROM bsit_students  WHERE user_id = NEW.user_id;
    DELETE FROM bscs_students  WHERE user_id = NEW.user_id;
    DELETE FROM bsemc_students WHERE user_id = NEW.user_id;

    -- Insert into the correct one (if matches)
    IF v_course_new = 'BSIT' THEN
      INSERT INTO bsit_students (user_id, email, full_name, student_number, section, created_at, updated_at)
      SELECT u.id, u.email, u.full_name, NEW.student_number, NEW.section, NOW(), NOW()
      FROM users u WHERE u.id = NEW.user_id;
    ELSEIF v_course_new = 'BSCS' THEN
      INSERT INTO bscs_students (user_id, email, full_name, student_number, section, created_at, updated_at)
      SELECT u.id, u.email, u.full_name, NEW.student_number, NEW.section, NOW(), NOW()
      FROM users u WHERE u.id = NEW.user_id;
    ELSEIF v_course_new = 'BSEMC' THEN
      INSERT INTO bsemc_students (user_id, email, full_name, student_number, section, created_at, updated_at)
      SELECT u.id, u.email, u.full_name, NEW.student_number, NEW.section, NOW(), NOW()
      FROM users u WHERE u.id = NEW.user_id;
    END IF;
  END IF;
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `student_profiles_bi_normalize` BEFORE INSERT ON `student_profiles` FOR EACH ROW BEGIN
  IF NEW.course IS NOT NULL THEN
    SET NEW.course = UPPER(TRIM(NEW.course));
  END IF;
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `student_profiles_bu_normalize` BEFORE UPDATE ON `student_profiles` FOR EACH ROW BEGIN
  IF NEW.course IS NOT NULL THEN
    SET NEW.course = UPPER(TRIM(NEW.course));
  END IF;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `subjects`
--

CREATE TABLE `subjects` (
  `id` int(10) UNSIGNED NOT NULL,
  `master_subject_id` bigint(20) UNSIGNED DEFAULT NULL,
  `code` varchar(32) NOT NULL,
  `name` varchar(191) NOT NULL,
  `course` enum('BSIT','BSCS','BSEMC') NOT NULL,
  `section` varchar(50) NOT NULL,
  `teacher_user_id` int(10) UNSIGNED NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `subjects`
--

INSERT INTO `subjects` (`id`, `master_subject_id`, `code`, `name`, `course`, `section`, `teacher_user_id`, `created_at`, `updated_at`) VALUES
(14, 1, '312', 'IPTC', 'BSIT', 'BSIT 3-Y2-4', 34, '2026-01-20 17:24:39', '2026-01-21 03:40:29'),
(15, 1, '312', 'NETW', 'BSIT', 'BSIT 3-Y2-4', 34, '2026-01-20 17:53:45', '2026-01-21 03:40:29'),
(17, 1, '312', 'NETW', 'BSEMC', 'BSIT 3-Y2-2', 34, '2026-01-20 19:01:51', '2026-01-21 03:40:29');

-- --------------------------------------------------------

--
-- Table structure for table `subject_enrollments`
--

CREATE TABLE `subject_enrollments` (
  `id` int(10) UNSIGNED NOT NULL,
  `subject_id` int(10) UNSIGNED NOT NULL,
  `student_id` int(10) UNSIGNED NOT NULL,
  `enrolled_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `status` enum('active','dropped','completed') DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `subject_enrollments`
--

INSERT INTO `subject_enrollments` (`id`, `subject_id`, `student_id`, `enrolled_at`, `status`, `created_at`, `updated_at`) VALUES
(18, 15, 32, '2026-01-20 20:01:23', 'active', '2026-01-20 20:01:23', '2026-01-20 20:01:23'),
(20, 15, 38, '2026-02-05 10:06:02', 'active', '2026-02-05 10:06:02', '2026-02-05 10:06:02');

-- --------------------------------------------------------

--
-- Table structure for table `teacher_profiles`
--

CREATE TABLE `teacher_profiles` (
  `user_id` int(10) UNSIGNED NOT NULL,
  `teacher_number` varchar(50) NOT NULL,
  `department` varchar(100) DEFAULT NULL,
  `specialization` varchar(255) DEFAULT NULL,
  `profile_picture` longtext DEFAULT NULL,
  `status` enum('active','inactive','on_leave') DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `teacher_profiles`
--

INSERT INTO `teacher_profiles` (`user_id`, `teacher_number`, `department`, `specialization`, `profile_picture`, `status`, `created_at`, `updated_at`) VALUES
(34, 'T-0001', NULL, NULL, NULL, 'active', '2026-01-20 17:24:28', '2026-02-05 10:23:49');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(10) UNSIGNED NOT NULL,
  `email` varchar(191) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('admin','teacher','student') NOT NULL,
  `full_name` varchar(191) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_by` int(10) UNSIGNED DEFAULT NULL,
  `last_login` timestamp NULL DEFAULT NULL,
  `email_verified_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `email`, `password`, `role`, `full_name`, `is_active`, `created_by`, `last_login`, `email_verified_at`, `created_at`, `updated_at`) VALUES
(1, 'admin@example.com', '$2y$12$s3V..DYb1q6jxVpocpBmB.k4GS4qXabrEonXcgzBUsgMDVjdS/5OO', 'admin', 'Alice Admin', 1, NULL, NULL, NULL, '2025-10-16 05:19:11', '2025-10-16 05:19:11'),
(32, 'student1@gmail.com', '$2y$12$GTBnpbfPyI5VHuBOtJ4MSO0Jvt5B9G8ZPHs7bryOQdYmep2y97W.W', 'student', 'Marquez B. Dizon', 1, 1, NULL, NULL, '2026-01-15 06:53:35', '2026-01-15 10:01:05'),
(34, 'gegewiwi678@gmail.com', '$2y$12$yxfN8l6m1b/kIy2oTOTQXOt.eRnQyFph6DfLiaM8HmWPMD5Sw4neC', 'teacher', 'Juan D. Marquez', 1, 1, NULL, NULL, '2026-01-20 17:24:28', '2026-01-20 17:24:28'),
(38, 'kaylepedroza@gmail.com', '$2y$12$WFLX6pnjh0VuN8WJzf1.PO37sDlOn/iw5EaoEDCWlsa/Y8J61FcWK', 'student', 'Kayle D. Ped', 1, 1, NULL, NULL, '2026-02-04 10:46:20', '2026-02-04 10:46:20');

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_admin_stats`
-- (See below for the actual view)
--
CREATE TABLE `v_admin_stats` (
`total_admins` bigint(21)
,`total_teachers` bigint(21)
,`total_students` bigint(21)
,`active_accounts` bigint(21)
,`inactive_accounts` bigint(21)
,`recent_logins` bigint(21)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_students_bscs`
-- (See below for the actual view)
--
CREATE TABLE `v_students_bscs` (
`user_id` int(10) unsigned
,`email` varchar(191)
,`full_name` varchar(191)
,`student_number` varchar(50)
,`section` varchar(50)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_students_bsemc`
-- (See below for the actual view)
--
CREATE TABLE `v_students_bsemc` (
`user_id` int(10) unsigned
,`email` varchar(191)
,`full_name` varchar(191)
,`student_number` varchar(50)
,`section` varchar(50)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_students_bsit`
-- (See below for the actual view)
--
CREATE TABLE `v_students_bsit` (
`user_id` int(10) unsigned
,`email` varchar(191)
,`full_name` varchar(191)
,`student_number` varchar(50)
,`section` varchar(50)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_student_enrolled_subjects`
-- (See below for the actual view)
--
CREATE TABLE `v_student_enrolled_subjects` (
`student_user_id` int(10) unsigned
,`subject_id` int(10) unsigned
,`code` varchar(32)
,`name` varchar(191)
,`course` enum('BSIT','BSCS','BSEMC')
,`section` varchar(50)
,`teacher_name` varchar(191)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_subject_students`
-- (See below for the actual view)
--
CREATE TABLE `v_subject_students` (
`enrollment_id` int(10) unsigned
,`subject_id` int(10) unsigned
,`student_user_id` int(10) unsigned
,`email` varchar(191)
,`full_name` varchar(191)
,`is_active` tinyint(1)
,`student_number` varchar(50)
,`course` varchar(100)
,`section` varchar(50)
,`profile_picture` varchar(255)
,`enrolled_at` timestamp
,`enrollment_status` enum('active','dropped','completed')
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_user_accounts`
-- (See below for the actual view)
--
CREATE TABLE `v_user_accounts` (
`id` int(10) unsigned
,`email` varchar(191)
,`full_name` varchar(191)
,`role` enum('admin','teacher','student')
,`is_active` tinyint(1)
,`created_by` int(10) unsigned
,`created_by_name` varchar(191)
,`last_login` timestamp
,`created_at` timestamp
,`updated_at` timestamp
,`account_number` varchar(100)
,`department_or_course` varchar(100)
);

-- --------------------------------------------------------

--
-- Structure for view `v_admin_stats`
--
DROP TABLE IF EXISTS `v_admin_stats`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_admin_stats`  AS SELECT (select count(0) from `users` where `users`.`role` = 'admin') AS `total_admins`, (select count(0) from `users` where `users`.`role` = 'teacher') AS `total_teachers`, (select count(0) from `users` where `users`.`role` = 'student') AS `total_students`, (select count(0) from `users` where `users`.`is_active` = 1) AS `active_accounts`, (select count(0) from `users` where `users`.`is_active` = 0) AS `inactive_accounts`, (select count(0) from `users` where `users`.`last_login` >= current_timestamp() - interval 7 day) AS `recent_logins` ;

-- --------------------------------------------------------

--
-- Structure for view `v_students_bscs`
--
DROP TABLE IF EXISTS `v_students_bscs`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_students_bscs`  AS SELECT `u`.`id` AS `user_id`, `u`.`email` AS `email`, `u`.`full_name` AS `full_name`, `sp`.`student_number` AS `student_number`, `sp`.`section` AS `section` FROM ((`users` `u` join `student_profiles` `sp` on(`sp`.`user_id` = `u`.`id`)) join `bscs_students` `cs` on(`cs`.`user_id` = `u`.`id`)) ;

-- --------------------------------------------------------

--
-- Structure for view `v_students_bsemc`
--
DROP TABLE IF EXISTS `v_students_bsemc`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_students_bsemc`  AS SELECT `u`.`id` AS `user_id`, `u`.`email` AS `email`, `u`.`full_name` AS `full_name`, `sp`.`student_number` AS `student_number`, `sp`.`section` AS `section` FROM ((`users` `u` join `student_profiles` `sp` on(`sp`.`user_id` = `u`.`id`)) join `bsemc_students` `emc` on(`emc`.`user_id` = `u`.`id`)) ;

-- --------------------------------------------------------

--
-- Structure for view `v_students_bsit`
--
DROP TABLE IF EXISTS `v_students_bsit`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_students_bsit`  AS SELECT `u`.`id` AS `user_id`, `u`.`email` AS `email`, `u`.`full_name` AS `full_name`, `sp`.`student_number` AS `student_number`, `sp`.`section` AS `section` FROM ((`users` `u` join `student_profiles` `sp` on(`sp`.`user_id` = `u`.`id`)) join `bsit_students` `bs` on(`bs`.`user_id` = `u`.`id`)) ;

-- --------------------------------------------------------

--
-- Structure for view `v_student_enrolled_subjects`
--
DROP TABLE IF EXISTS `v_student_enrolled_subjects`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_student_enrolled_subjects`  AS SELECT `se`.`student_id` AS `student_user_id`, `s`.`id` AS `subject_id`, `s`.`code` AS `code`, `s`.`name` AS `name`, `s`.`course` AS `course`, `s`.`section` AS `section`, `t`.`full_name` AS `teacher_name` FROM ((`subject_enrollments` `se` join `subjects` `s` on(`s`.`id` = `se`.`subject_id`)) left join `users` `t` on(`t`.`id` = `s`.`teacher_user_id`)) ;

-- --------------------------------------------------------

--
-- Structure for view `v_subject_students`
--
DROP TABLE IF EXISTS `v_subject_students`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_subject_students`  AS SELECT `se`.`id` AS `enrollment_id`, `se`.`subject_id` AS `subject_id`, `se`.`student_id` AS `student_user_id`, `u`.`email` AS `email`, `u`.`full_name` AS `full_name`, `u`.`is_active` AS `is_active`, `sp`.`student_number` AS `student_number`, `sp`.`course` AS `course`, `sp`.`section` AS `section`, `sp`.`profile_picture` AS `profile_picture`, `se`.`enrolled_at` AS `enrolled_at`, `se`.`status` AS `enrollment_status` FROM ((`subject_enrollments` `se` join `users` `u` on(`u`.`id` = `se`.`student_id`)) left join `student_profiles` `sp` on(`sp`.`user_id` = `se`.`student_id`)) ;

-- --------------------------------------------------------

--
-- Structure for view `v_user_accounts`
--
DROP TABLE IF EXISTS `v_user_accounts`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_user_accounts`  AS SELECT `u`.`id` AS `id`, `u`.`email` AS `email`, `u`.`full_name` AS `full_name`, `u`.`role` AS `role`, `u`.`is_active` AS `is_active`, `u`.`created_by` AS `created_by`, `creator`.`full_name` AS `created_by_name`, `u`.`last_login` AS `last_login`, `u`.`created_at` AS `created_at`, `u`.`updated_at` AS `updated_at`, CASE WHEN `u`.`role` = 'student' THEN `sp`.`student_number` WHEN `u`.`role` = 'teacher' THEN `tp`.`teacher_number` WHEN `u`.`role` = 'admin' THEN `ap`.`position` ELSE NULL END AS `account_number`, CASE WHEN `u`.`role` = 'student' THEN `sp`.`course` WHEN `u`.`role` = 'teacher' THEN `tp`.`department` WHEN `u`.`role` = 'admin' THEN `ap`.`position` ELSE NULL END AS `department_or_course` FROM ((((`users` `u` left join `users` `creator` on(`u`.`created_by` = `creator`.`id`)) left join `student_profiles` `sp` on(`u`.`id` = `sp`.`user_id` and `u`.`role` = 'student')) left join `teacher_profiles` `tp` on(`u`.`id` = `tp`.`user_id` and `u`.`role` = 'teacher')) left join `admin_profiles` `ap` on(`u`.`id` = `ap`.`user_id` and `u`.`role` = 'admin')) ;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `admin_profiles`
--
ALTER TABLE `admin_profiles`
  ADD PRIMARY KEY (`user_id`);

--
-- Indexes for table `attendance_logs`
--
ALTER TABLE `attendance_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_attendance_subject` (`subject_id`),
  ADD KEY `idx_attendance_student` (`student_id`),
  ADD KEY `idx_attendance_status` (`status`),
  ADD KEY `idx_attendance_date` (`attendance_date`),
  ADD KEY `fk_attendance_teacher` (`teacher_user_id`);

--
-- Indexes for table `browser_activities`
--
ALTER TABLE `browser_activities`
  ADD PRIMARY KEY (`id`),
  ADD KEY `browser_activities_student_user_id_index` (`student_user_id`),
  ADD KEY `browser_activities_visit_timestamp_index` (`visit_timestamp`),
  ADD KEY `browser_activities_session_id_index` (`session_id`);

--
-- Indexes for table `bscs_students`
--
ALTER TABLE `bscs_students`
  ADD PRIMARY KEY (`user_id`),
  ADD UNIQUE KEY `student_number` (`student_number`);

--
-- Indexes for table `bsemc_students`
--
ALTER TABLE `bsemc_students`
  ADD PRIMARY KEY (`user_id`),
  ADD UNIQUE KEY `student_number` (`student_number`);

--
-- Indexes for table `bsit_students`
--
ALTER TABLE `bsit_students`
  ADD PRIMARY KEY (`user_id`),
  ADD UNIQUE KEY `student_number` (`student_number`);

--
-- Indexes for table `course_sections`
--
ALTER TABLE `course_sections`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_course_section` (`course`,`section`);

--
-- Indexes for table `email_verification_codes`
--
ALTER TABLE `email_verification_codes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_email` (`email`),
  ADD KEY `idx_email_used` (`email`,`used`);

--
-- Indexes for table `incognito_alerts`
--
ALTER TABLE `incognito_alerts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `incognito_alerts_student_user_id_index` (`student_user_id`),
  ADD KEY `incognito_alerts_detected_at_index` (`detected_at`),
  ADD KEY `incognito_alerts_is_acknowledged_index` (`is_acknowledged`);

--
-- Indexes for table `master_subjects`
--
ALTER TABLE `master_subjects`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `master_subjects_code_unique` (`code`);

--
-- Indexes for table `migrations`
--
ALTER TABLE `migrations`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `monitoring_sessions`
--
ALTER TABLE `monitoring_sessions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `monitoring_sessions_created_by_foreign` (`created_by`),
  ADD KEY `monitoring_sessions_student_user_id_index` (`student_user_id`),
  ADD KEY `monitoring_sessions_is_active_index` (`is_active`),
  ADD KEY `monitoring_sessions_session_start_index` (`session_start`);

--
-- Indexes for table `personal_access_tokens`
--
ALTER TABLE `personal_access_tokens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `token` (`token`),
  ADD UNIQUE KEY `personal_access_tokens_token_unique` (`token`),
  ADD KEY `personal_access_tokens_tokenable_type_tokenable_id_index` (`tokenable_type`,`tokenable_id`);

--
-- Indexes for table `student_barcodes`
--
ALTER TABLE `student_barcodes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_student_barcodes_barcode` (`barcode`),
  ADD KEY `idx_student_barcodes_user` (`user_id`),
  ADD KEY `idx_student_barcodes_used` (`used`);

--
-- Indexes for table `student_pins`
--
ALTER TABLE `student_pins`
  ADD PRIMARY KEY (`user_id`);

--
-- Indexes for table `student_profiles`
--
ALTER TABLE `student_profiles`
  ADD PRIMARY KEY (`user_id`),
  ADD UNIQUE KEY `student_number` (`student_number`),
  ADD KEY `idx_student_profiles_course` (`course`),
  ADD KEY `idx_student_profiles_section` (`section`);

--
-- Indexes for table `subjects`
--
ALTER TABLE `subjects`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_subjects_course_section` (`course`,`section`),
  ADD KEY `idx_subjects_teacher` (`teacher_user_id`),
  ADD KEY `subjects_master_subject_id_foreign` (`master_subject_id`);

--
-- Indexes for table `subject_enrollments`
--
ALTER TABLE `subject_enrollments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_enrollment` (`subject_id`,`student_id`),
  ADD KEY `idx_enrollments_subject` (`subject_id`),
  ADD KEY `idx_enrollments_student` (`student_id`),
  ADD KEY `idx_enrollments_status` (`status`);

--
-- Indexes for table `teacher_profiles`
--
ALTER TABLE `teacher_profiles`
  ADD PRIMARY KEY (`user_id`),
  ADD UNIQUE KEY `teacher_number` (`teacher_number`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `idx_users_role` (`role`),
  ADD KEY `idx_users_created_by` (`created_by`),
  ADD KEY `idx_users_is_active` (`is_active`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `attendance_logs`
--
ALTER TABLE `attendance_logs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `browser_activities`
--
ALTER TABLE `browser_activities`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1600;

--
-- AUTO_INCREMENT for table `course_sections`
--
ALTER TABLE `course_sections`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `email_verification_codes`
--
ALTER TABLE `email_verification_codes`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=48;

--
-- AUTO_INCREMENT for table `incognito_alerts`
--
ALTER TABLE `incognito_alerts`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `master_subjects`
--
ALTER TABLE `master_subjects`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `migrations`
--
ALTER TABLE `migrations`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `monitoring_sessions`
--
ALTER TABLE `monitoring_sessions`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;

--
-- AUTO_INCREMENT for table `personal_access_tokens`
--
ALTER TABLE `personal_access_tokens`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=81;

--
-- AUTO_INCREMENT for table `student_barcodes`
--
ALTER TABLE `student_barcodes`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=42;

--
-- AUTO_INCREMENT for table `subjects`
--
ALTER TABLE `subjects`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18;

--
-- AUTO_INCREMENT for table `subject_enrollments`
--
ALTER TABLE `subject_enrollments`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=39;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `admin_profiles`
--
ALTER TABLE `admin_profiles`
  ADD CONSTRAINT `fk_admin_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `attendance_logs`
--
ALTER TABLE `attendance_logs`
  ADD CONSTRAINT `fk_attendance_student` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_attendance_subject` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_attendance_teacher` FOREIGN KEY (`teacher_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `browser_activities`
--
ALTER TABLE `browser_activities`
  ADD CONSTRAINT `browser_activities_student_user_id_foreign` FOREIGN KEY (`student_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `bscs_students`
--
ALTER TABLE `bscs_students`
  ADD CONSTRAINT `fk_bscs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `bsemc_students`
--
ALTER TABLE `bsemc_students`
  ADD CONSTRAINT `fk_bsemc_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `bsit_students`
--
ALTER TABLE `bsit_students`
  ADD CONSTRAINT `fk_bsit_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `incognito_alerts`
--
ALTER TABLE `incognito_alerts`
  ADD CONSTRAINT `incognito_alerts_student_user_id_foreign` FOREIGN KEY (`student_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `monitoring_sessions`
--
ALTER TABLE `monitoring_sessions`
  ADD CONSTRAINT `monitoring_sessions_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `monitoring_sessions_student_user_id_foreign` FOREIGN KEY (`student_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `student_barcodes`
--
ALTER TABLE `student_barcodes`
  ADD CONSTRAINT `fk_student_barcodes_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `student_pins`
--
ALTER TABLE `student_pins`
  ADD CONSTRAINT `fk_student_pins_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `student_profiles`
--
ALTER TABLE `student_profiles`
  ADD CONSTRAINT `fk_student_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `subjects`
--
ALTER TABLE `subjects`
  ADD CONSTRAINT `fk_subjects_teacher` FOREIGN KEY (`teacher_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `subjects_master_subject_id_foreign` FOREIGN KEY (`master_subject_id`) REFERENCES `master_subjects` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `subject_enrollments`
--
ALTER TABLE `subject_enrollments`
  ADD CONSTRAINT `fk_enrollments_student` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_enrollments_subject` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `teacher_profiles`
--
ALTER TABLE `teacher_profiles`
  ADD CONSTRAINT `fk_teacher_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `fk_users_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON UPDATE CASCADE;
COMMIT;
