-- CreateTable
CREATE TABLE `admin_users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(150) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `phone` VARCHAR(20) NULL,
    `role` ENUM('super_admin', 'admin', 'manager') NOT NULL DEFAULT 'admin',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `admin_users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permissions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `admin_id` INTEGER NOT NULL,
    `can_view_leads` BOOLEAN NOT NULL DEFAULT true,
    `can_edit_leads` BOOLEAN NOT NULL DEFAULT true,
    `can_delete_leads` BOOLEAN NOT NULL DEFAULT false,
    `can_export_leads` BOOLEAN NOT NULL DEFAULT false,
    `can_view_reports` BOOLEAN NOT NULL DEFAULT true,
    `can_manage_filters` BOOLEAN NOT NULL DEFAULT true,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `permissions_admin_id_key`(`admin_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `program_assignments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `admin_id` INTEGER NOT NULL,
    `program` VARCHAR(255) NOT NULL,

    UNIQUE INDEX `program_assignments_admin_id_program_key`(`admin_id`, `program`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leads` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `full_name` VARCHAR(150) NOT NULL,
    `country_code` VARCHAR(10) NOT NULL DEFAULT '+91',
    `phone` VARCHAR(20) NOT NULL,
    `email` VARCHAR(150) NOT NULL,
    `city` VARCHAR(100) NULL,
    `state` VARCHAR(100) NULL,
    `program_level` VARCHAR(50) NULL,
    `program` VARCHAR(255) NULL,
    `hear_about` VARCHAR(100) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'new',
    `assigned_to` INTEGER NULL,
    `notes` TEXT NULL,
    `utm_source` VARCHAR(150) NULL,
    `utm_medium` VARCHAR(150) NULL,
    `utm_campaign` VARCHAR(150) NULL,
    `utm_term` VARCHAR(150) NULL,
    `utm_content` VARCHAR(150) NULL,
    `utm_name` VARCHAR(150) NULL,
    `form_source` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `leads_status_idx`(`status`),
    INDEX `leads_assigned_to_idx`(`assigned_to`),
    INDEX `leads_created_at_idx`(`created_at`),
    INDEX `leads_phone_idx`(`phone`),
    INDEX `leads_program_level_idx`(`program_level`),
    INDEX `leads_program_idx`(`program`),
    INDEX `leads_status_assigned_to_idx`(`status`, `assigned_to`),
    INDEX `leads_status_created_at_idx`(`status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `activities` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lead_id` INTEGER NOT NULL,
    `admin_id` INTEGER NOT NULL,
    `type` ENUM('note', 'call', 'whatsapp', 'email', 'visit', 'status_change', 'follow_up', 'lead_created') NOT NULL,
    `note` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `activities_lead_id_idx`(`lead_id`),
    INDEX `activities_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `follow_ups` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lead_id` INTEGER NOT NULL,
    `admin_id` INTEGER NOT NULL,
    `scheduled_at` DATETIME(3) NOT NULL,
    `note` VARCHAR(500) NULL,
    `status` ENUM('pending', 'done', 'missed') NOT NULL DEFAULT 'pending',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `follow_ups_lead_id_idx`(`lead_id`),
    INDEX `follow_ups_admin_id_status_scheduled_at_idx`(`admin_id`, `status`, `scheduled_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `call_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lead_id` INTEGER NOT NULL,
    `admin_id` INTEGER NOT NULL,
    `called_at` DATETIME(3) NOT NULL,
    `duration` INTEGER NULL,
    `outcome` ENUM('answered', 'not_answered', 'busy', 'callback_requested') NOT NULL,
    `notes` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `filters` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `created_by` INTEGER NOT NULL,
    `filter_config` JSON NOT NULL,
    `is_shared` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contact_inquiries` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `full_name` VARCHAR(150) NOT NULL,
    `phone` VARCHAR(20) NULL,
    `email` VARCHAR(150) NOT NULL,
    `program` VARCHAR(255) NULL,
    `message` TEXT NOT NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'new',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead_status_configs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `label` VARCHAR(100) NOT NULL,
    `value` VARCHAR(100) NOT NULL,
    `color` VARCHAR(50) NOT NULL,
    `stage` VARCHAR(20) NOT NULL DEFAULT 'active',
    `order` INTEGER NOT NULL DEFAULT 0,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `lead_status_configs_value_key`(`value`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `permissions` ADD CONSTRAINT `permissions_admin_id_fkey` FOREIGN KEY (`admin_id`) REFERENCES `admin_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `program_assignments` ADD CONSTRAINT `program_assignments_admin_id_fkey` FOREIGN KEY (`admin_id`) REFERENCES `admin_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_assigned_to_fkey` FOREIGN KEY (`assigned_to`) REFERENCES `admin_users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activities` ADD CONSTRAINT `activities_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activities` ADD CONSTRAINT `activities_admin_id_fkey` FOREIGN KEY (`admin_id`) REFERENCES `admin_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `follow_ups` ADD CONSTRAINT `follow_ups_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `follow_ups` ADD CONSTRAINT `follow_ups_admin_id_fkey` FOREIGN KEY (`admin_id`) REFERENCES `admin_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `call_logs` ADD CONSTRAINT `call_logs_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `call_logs` ADD CONSTRAINT `call_logs_admin_id_fkey` FOREIGN KEY (`admin_id`) REFERENCES `admin_users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `filters` ADD CONSTRAINT `filters_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `admin_users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

