-- CreateTable
CREATE TABLE `site_config` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(50) NOT NULL,
    `topbar_text` TEXT NULL,
    `button_name` VARCHAR(100) NULL,
    `button_link` VARCHAR(500) NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `site_config_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `gallery_media` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` VARCHAR(10) NOT NULL,
    `filename` VARCHAR(255) NOT NULL,
    `url` VARCHAR(500) NOT NULL,
    `size` INTEGER NOT NULL,
    `mime_type` VARCHAR(100) NOT NULL,
    `section` VARCHAR(50) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `gallery_media_section_idx`(`section`),
    INDEX `gallery_media_section_sort_order_idx`(`section`, `sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `events` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(255) NOT NULL,
    `image_url` VARCHAR(500) NOT NULL,
    `event_date` DATETIME(3) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'active',
    `moved_to_gallery` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `events_status_idx`(`status`),
    INDEX `events_event_date_idx`(`event_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `activity_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `section` VARCHAR(100) NOT NULL,
    `type` VARCHAR(10) NOT NULL,
    `url` VARCHAR(500) NOT NULL,
    `filename` VARCHAR(255) NOT NULL,
    `heading` VARCHAR(255) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `activity_items_section_idx`(`section`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed default top bar config
INSERT INTO `site_config` (`key`, `topbar_text`, `button_name`, `button_link`, `enabled`, `updated_at`)
VALUES ('topbar', 'Admissions Open for 2027-28', 'Apply Now', '/admissions', true, NOW());
