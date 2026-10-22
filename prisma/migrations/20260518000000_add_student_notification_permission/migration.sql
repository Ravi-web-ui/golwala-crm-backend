-- Add can_receive_student_notifications permission field
ALTER TABLE `permissions` ADD COLUMN `can_receive_student_notifications` BOOLEAN NOT NULL DEFAULT false AFTER `can_manage_filters`;
