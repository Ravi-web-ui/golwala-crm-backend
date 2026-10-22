-- Add program selection fields to student_admissions table
ALTER TABLE `student_admissions` 
ADD COLUMN `program_category` VARCHAR(100) NULL AFTER `application_no`,
ADD COLUMN `program_type` VARCHAR(100) NULL AFTER `program_category`,
ADD COLUMN `program_name` VARCHAR(255) NULL AFTER `program_type`;

-- Add index for faster filtering by program type
CREATE INDEX `idx_program_type` ON `student_admissions`(`program_type`);
