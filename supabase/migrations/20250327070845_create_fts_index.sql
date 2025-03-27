-- Migration: Add Weighted Full Text Search Index to atlas.pages
-- Description: Creates a GIN index on a weighted combination of title, description and
--              processed_content tsvectors to prioritize matches in description.

-- Create the new weighted index
CREATE INDEX idx_pages_fts_weighted
ON atlas.pages
USING GIN (
    (
      setweight(to_tsvector('english', coalesce(title,'')), 'A') || -- Highest weight
      setweight(to_tsvector('english', coalesce(description,'')), 'A') || -- Highest weight
      setweight(to_tsvector('english', coalesce(processed_content,'')), 'D') -- Lowest weight
    )
);
