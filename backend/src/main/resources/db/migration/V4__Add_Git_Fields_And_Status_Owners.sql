-- Add GitHub/Git integration fields to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS github_repo VARCHAR(255);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS branches TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS active_branch VARCHAR(100);

-- Add status ownership tracking
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS pending_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Initialize pending_by from created_by for existing tasks
UPDATE tasks SET pending_by = created_by WHERE pending_by IS NULL;
