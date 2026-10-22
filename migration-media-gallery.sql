-- =========================================
-- Media Gallery System - Database Migration
-- SAFE: Only adds new table, existing data untouched
-- =========================================

-- Check if table already exists
SELECT 
    CASE WHEN COUNT(*) > 0 
        THEN 'Table already exists - SKIPPING'
        ELSE 'Creating table...'
    END as status
FROM information_schema.tables 
WHERE table_schema = DATABASE() 
  AND table_name = 'media_library';

-- Create media_library table
CREATE TABLE IF NOT EXISTS media_library (
    id INT AUTO_INCREMENT PRIMARY KEY,
    type VARCHAR(10) NOT NULL COMMENT 'image or video',
    filename VARCHAR(255) NOT NULL,
    url VARCHAR(500) NOT NULL,
    thumbnail_url VARCHAR(500) DEFAULT NULL COMMENT 'Auto-generated for videos',
    size INT NOT NULL COMMENT 'File size in bytes',
    mime_type VARCHAR(100) NOT NULL,
    title VARCHAR(255) DEFAULT NULL,
    alt_text VARCHAR(255) DEFAULT NULL,
    caption TEXT DEFAULT NULL,
    uploaded_by INT DEFAULT NULL COMMENT 'References admin_users.id',
    tags TEXT DEFAULT NULL COMMENT 'JSON array of tags',
    usage_count INT DEFAULT 0 COMMENT 'Track where media is used',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_type (type),
    INDEX idx_created (created_at),
    INDEX idx_uploaded_by (uploaded_by)
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Universal media library for images and videos';

-- Verify table created
SELECT 
    table_name,
    table_rows,
    ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'size_mb',
    create_time
FROM information_schema.tables
WHERE table_schema = DATABASE() 
  AND table_name = 'media_library';

-- Show table structure
DESCRIBE media_library;

-- Success message
SELECT 
    '✅ Migration completed successfully!' as status,
    'media_library table created' as details,
    'Existing tables and data are safe' as note;
