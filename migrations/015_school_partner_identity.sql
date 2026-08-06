-- Pilot partner identity + store-only school feedback.
-- Seeds Founding Partner + PoC on Demo School only (not Demo School B).

BEGIN;

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS partner_label TEXT,
  ADD COLUMN IF NOT EXISTS welcome_blurb TEXT,
  ADD COLUMN IF NOT EXISTS poc_name TEXT,
  ADD COLUMN IF NOT EXISTS poc_email TEXT,
  ADD COLUMN IF NOT EXISTS poc_title TEXT;

COMMENT ON COLUMN schools.partner_label IS
  'Nullable cohort badge, e.g. Founding Partner School, 2026 Cohort. Null = no partner chrome.';
COMMENT ON COLUMN schools.poc_name IS
  'Dedicated advisor display name for Gusto-style PoC card.';
COMMENT ON COLUMN schools.poc_email IS
  'Dedicated advisor contact email.';
COMMENT ON COLUMN schools.poc_title IS
  'Advisor title shown under name, e.g. Your dedicated advisor.';

-- Demo School (founding partner). Demo School B intentionally left null.
UPDATE schools
   SET partner_label = 'Founding Partner School, 2026 Cohort',
       welcome_blurb = 'Your teachers'' feedback shapes what ships next.',
       poc_name = 'Aanya Sikka',
       poc_email = 'dev@propelup.ai',
       poc_title = 'Your dedicated advisor',
       updated_at = NOW()
 WHERE name = 'Demo School'
   AND (partner_label IS DISTINCT FROM 'Founding Partner School, 2026 Cohort'
        OR poc_email IS DISTINCT FROM 'dev@propelup.ai');

CREATE TABLE IF NOT EXISTS school_feedback (
  id          SERIAL PRIMARY KEY,
  school_id   INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  message     TEXT NOT NULL,
  page_path   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_school_feedback_message_len CHECK (char_length(message) BETWEEN 1 AND 4000)
);

CREATE INDEX IF NOT EXISTS idx_school_feedback_school_created
  ON school_feedback (school_id, created_at DESC);

COMMENT ON TABLE school_feedback IS
  'Teacher/admin feedback from partner schools. Store-only; no routing yet.';

COMMIT;
