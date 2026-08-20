ALTER TABLE predictions ADD COLUMN IF NOT EXISTS result jsonb;
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS verdict text;
