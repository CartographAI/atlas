-- Create atlas schema
CREATE SCHEMA IF NOT EXISTS atlas;

-- Create docs table
CREATE TABLE atlas.docs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    source_url VARCHAR(2048) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create pages table
CREATE TABLE atlas.pages (
    id SERIAL PRIMARY KEY,
    doc_id INTEGER NOT NULL REFERENCES atlas.docs(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    source_content TEXT,
    processed_content TEXT NOT NULL,
    slug VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_docs_name ON atlas.docs(name);
CREATE INDEX idx_pages_doc_id ON atlas.pages(doc_id);
CREATE INDEX idx_pages_slug ON atlas.pages(slug);
CREATE UNIQUE INDEX idx_pages_doc_id_slug ON atlas.pages(doc_id, slug);

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at column
CREATE TRIGGER update_docs_updated_at
    BEFORE UPDATE ON atlas.docs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pages_updated_at
    BEFORE UPDATE ON atlas.pages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
