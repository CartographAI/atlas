-- Drop the existing unique index that includes the slug column
DROP INDEX atlas.idx_pages_doc_id_slug;

-- Drop the index on slug column
DROP INDEX atlas.idx_pages_slug;

-- Rename the slug column to path
ALTER TABLE atlas.pages
RENAME COLUMN slug TO path;

-- Create new indexes with the updated column name
CREATE INDEX idx_pages_path ON atlas.pages(path);
CREATE UNIQUE INDEX idx_pages_doc_id_path ON atlas.pages(doc_id, path);
