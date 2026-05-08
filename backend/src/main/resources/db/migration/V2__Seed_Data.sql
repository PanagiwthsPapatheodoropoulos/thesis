-- Insert default company FIRST (before any FK references)
INSERT INTO companies (id, name, join_code, is_active, created_at)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Default Company',
    'DEFAULT',
    true,
    CURRENT_TIMESTAMP
) ON CONFLICT (id) DO NOTHING;

INSERT INTO teams (name, description, company_id) VALUES
('Development Team', 'Main development team for AI projects', '00000000-0000-0000-0000-000000000001'),
('Marketing Team', 'Marketing and communications team', '00000000-0000-0000-0000-000000000001');

INSERT INTO skills (name, category, description) VALUES
-- Programming Languages
('Java', 'Programming', 'Java programming language'),
('Python', 'Programming', 'Python programming language'),
('TypeScript', 'Programming', 'TypeScript superset of JavaScript'),
('JavaScript', 'Programming', 'JavaScript programming language'),
('C#', 'Programming', 'C# programming language (.NET ecosystem)'),
('Go', 'Programming', 'Go (Golang) programming language'),
('Kotlin', 'Programming', 'Kotlin programming language (JVM/Android)'),
('C++', 'Programming', 'C++ systems programming language'),
('Rust', 'Programming', 'Rust systems programming language'),
('PHP', 'Programming', 'PHP server-side scripting language'),
('Ruby', 'Programming', 'Ruby dynamic programming language'),
('Swift', 'Programming', 'Swift programming language (Apple ecosystem)'),
-- Frontend
('React', 'Frontend', 'React JavaScript library'),
('Angular', 'Frontend', 'Angular frontend framework'),
('Vue.js', 'Frontend', 'Vue.js progressive framework'),
('Next.js', 'Frontend', 'Next.js React meta-framework'),
('HTML/CSS', 'Frontend', 'Core web markup and styling'),
('Tailwind CSS', 'Frontend', 'Utility-first CSS framework'),
('Svelte', 'Frontend', 'Svelte compiler-based UI framework'),
-- Backend / Frameworks
('Spring Boot', 'Backend', 'Java Spring Boot framework'),
('Node.js', 'Backend', 'Node.js JavaScript runtime'),
('Django', 'Backend', 'Python Django web framework'),
('FastAPI', 'Backend', 'Python FastAPI async framework'),
('GraphQL', 'Backend', 'GraphQL API query language'),
('Express.js', 'Backend', 'Express.js Node.js framework'),
('.NET', 'Backend', '.NET framework and ecosystem'),
-- DevOps & Cloud
('Docker', 'DevOps', 'Container management'),
('Kubernetes', 'DevOps', 'Container orchestration platform'),
('AWS', 'DevOps', 'Amazon Web Services cloud platform'),
('Azure', 'DevOps', 'Microsoft Azure cloud platform'),
('Terraform', 'DevOps', 'Infrastructure as code tool'),
('CI/CD', 'DevOps', 'Continuous integration and delivery pipelines'),
('Linux', 'DevOps', 'Linux system administration'),
('Nginx', 'DevOps', 'Nginx web server and reverse proxy'),
-- Database
('SQL', 'Database', 'SQL database management'),
('PostgreSQL', 'Database', 'PostgreSQL relational database'),
('MongoDB', 'Database', 'MongoDB NoSQL document database'),
('Redis', 'Database', 'Redis in-memory data store'),
('MySQL', 'Database', 'MySQL relational database'),
('Elasticsearch', 'Database', 'Elasticsearch search and analytics engine'),
-- AI / Machine Learning
('Machine Learning', 'AI/ML', 'Machine learning algorithms and models'),
('TensorFlow', 'AI/ML', 'TensorFlow deep learning framework'),
('PyTorch', 'AI/ML', 'PyTorch deep learning framework'),
('NLP', 'AI/ML', 'Natural language processing'),
('Computer Vision', 'AI/ML', 'Image and video analysis'),
('Pandas', 'AI/ML', 'Python data manipulation library'),
('Data Science', 'AI/ML', 'Statistical analysis and data modeling'),
-- Testing & QA
('JUnit', 'Testing', 'Java unit testing framework'),
('Selenium', 'Testing', 'Browser automation testing'),
('Cypress', 'Testing', 'Modern end-to-end testing framework'),
('Jest', 'Testing', 'JavaScript testing framework'),
('Pytest', 'Testing', 'Python testing framework'),
-- Security
('OAuth', 'Security', 'OAuth authentication protocol'),
('JWT', 'Security', 'JSON Web Token authentication'),
('Cybersecurity', 'Security', 'Information security practices'),
('Penetration Testing', 'Security', 'Security vulnerability assessment'),
-- Project Management
('Agile', 'Management', 'Agile project methodology'),
('Scrum', 'Management', 'Scrum framework for agile teams'),
('Jira', 'Management', 'Jira project tracking tool'),
('Leadership', 'Management', 'Team leadership and management'),
('Technical Writing', 'Management', 'Documentation and technical communication'),
-- Design
('UI/UX Design', 'Design', 'User interface and experience design'),
('Figma', 'Design', 'Figma collaborative design tool'),
('Responsive Design', 'Design', 'Cross-device responsive layouts');

INSERT INTO departments (name, description, company_id) VALUES
('Engineering', 'Software development and technical teams', '00000000-0000-0000-0000-000000000001'),
('Marketing', 'Marketing and brand management', '00000000-0000-0000-0000-000000000001'),
('Sales', 'Sales and business development', '00000000-0000-0000-0000-000000000001'),
('Human Resources', 'HR and people operations', '00000000-0000-0000-0000-000000000001'),
('Finance', 'Accounting and financial planning', '00000000-0000-0000-0000-000000000001');

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