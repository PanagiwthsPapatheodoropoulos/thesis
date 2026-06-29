-- Add dev_info_enabled column to departments
ALTER TABLE departments ADD COLUMN IF NOT EXISTS dev_info_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Enable dev info by default for common development/tech departments
UPDATE departments 
SET dev_info_enabled = TRUE 
WHERE LOWER(name) IN ('engineering', 'development', 'it', 'software', 'tech', 'devops', 'r&d', 'research & development', 'qa', 'quality assurance');
