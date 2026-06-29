ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'OFFLINE' NOT NULL;

-- Optionally, if there were active sessions, we could map them. But typically everyone starts as offline.
UPDATE users SET status = 'OFFLINE';

ALTER TABLE users DROP COLUMN is_active;
