-- Add custom commits column to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS custom_commits TEXT;
