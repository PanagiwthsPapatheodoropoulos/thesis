-- Create Company Blocklist Table
CREATE TABLE company_blocklist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    email VARCHAR(150) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(company_id, email)
);

-- Index for performance
CREATE INDEX idx_company_blocklist_company ON company_blocklist(company_id);
CREATE INDEX idx_company_blocklist_email ON company_blocklist(email);
