INSERT INTO teams (name, description) VALUES
('Development Team', 'Main development team for AI projects'),
('Marketing Team', 'Marketing and communications team');

INSERT INTO skills (name, category, description) VALUES
('Java', 'Programming', 'Java programming language'),
('Python', 'Programming', 'Python programming language'),
('React', 'Frontend', 'React JavaScript library'),
('Machine Learning', 'AI/ML', 'Machine learning algorithms and models'),
('SQL', 'Database', 'SQL database management'),
('Docker', 'DevOps', 'Container management'),
('Spring Boot', 'Framework', 'Java Spring Boot framework');

INSERT INTO departments (name, description) VALUES
('Engineering', 'Software development and technical teams'),
('Marketing', 'Marketing and brand management'),
('Sales', 'Sales and business development'),
('Human Resources', 'HR and people operations'),
('Finance', 'Accounting and financial planning');

INSERT INTO companies (id, name, join_code, is_active, created_at)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Default Company',
    'DEFAULT',
    true,
    CURRENT_TIMESTAMP
) ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, username, email, password_hash, role, is_active, company_id, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000099',
    'superadmin',
    'superadmin@system.com',
    '$2a$12$Yfl05fsJj/4Cwad93nRCLu7/PmzZ.hzBnb7Yn32c1wZpHNSNKH4Pi',
    'SUPER_ADMIN',
    true,
    NULL,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (id) DO NOTHING;