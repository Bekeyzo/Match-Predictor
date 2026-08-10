-- New column; existing rows default to TRUE so current users aren't locked out
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE users SET verified = TRUE WHERE verified = FALSE;
-- New signups should start unverified, so flip the default AFTER grandfathering
ALTER TABLE users ALTER COLUMN verified SET DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS verification_tokens (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS verification_tokens_token_idx ON verification_tokens (token);
