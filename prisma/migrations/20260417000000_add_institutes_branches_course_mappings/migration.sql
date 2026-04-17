-- Add institute and branch columns to leads
ALTER TABLE `leads`
  ADD COLUMN `institute` VARCHAR(150) NULL AFTER `program`,
  ADD COLUMN `branch`    VARCHAR(150) NULL AFTER `institute`;

-- Institutes table
CREATE TABLE `institutes` (
  `id`                INT          NOT NULL AUTO_INCREMENT,
  `name`              VARCHAR(150) NOT NULL,
  `genio_subdomain`   VARCHAR(100) NULL,
  `genio_college_id`  INT          NULL,
  `created_at`        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `institutes_name_key` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Branches table
CREATE TABLE `branches` (
  `id`                INT          NOT NULL AUTO_INCREMENT,
  `institute_id`      INT          NOT NULL,
  `name`              VARCHAR(150) NOT NULL,
  `genio_branch_id`   INT          NULL,
  `created_at`        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `branches_institute_id_name_key` (`institute_id`, `name`),
  CONSTRAINT `branches_institute_id_fkey`
    FOREIGN KEY (`institute_id`) REFERENCES `institutes` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Course mappings table
CREATE TABLE `course_mappings` (
  `id`                       INT          NOT NULL AUTO_INCREMENT,
  `branch_id`                INT          NOT NULL,
  `our_course_name`          VARCHAR(255) NOT NULL,
  `external_course_name`     VARCHAR(255) NOT NULL,
  `genio_course_id`          INT          NULL,
  `genio_specialization_id`  INT          NULL,
  `created_at`               DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  CONSTRAINT `course_mappings_branch_id_fkey`
    FOREIGN KEY (`branch_id`) REFERENCES `branches` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
