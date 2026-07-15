-- Student observation journal: per-student mastery marks for each activity in a section.
-- Run after 010_seed_activity_emojis.sql
--
-- Teachers mark each student on a 3-rung mastery ladder for a given quest/activity:
--   got_answer     (rank 1) — reached the correct answer
--   got_rule       (rank 2) — articulated the underlying rule/pattern
--   able_to_teach  (rank 3) — can explain/teach it to a peer
-- Absence of a row = not yet assessed. An optional free-text remark can accompany
-- any mark (or stand alone before a level is chosen).
-- Safe to re-run.

BEGIN;

CREATE TABLE IF NOT EXISTS student_activity_journal (
  id                SERIAL PRIMARY KEY,
  section_id        INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  activity_id       INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  student_user_id   UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  level             TEXT,
  remark            TEXT,
  assessed_by       UUID REFERENCES users(user_id) ON DELETE SET NULL,
  assessed_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_student_activity_journal UNIQUE (section_id, activity_id, student_user_id),
  CONSTRAINT chk_student_activity_journal_level CHECK (
    level IS NULL OR level IN ('got_answer', 'got_rule', 'able_to_teach')
  )
);

COMMENT ON TABLE student_activity_journal IS
  'Per-student mastery observation per activity within a section. level is a 3-rung ladder; NULL = not assessed.';
COMMENT ON COLUMN student_activity_journal.level IS
  'got_answer < got_rule < able_to_teach. NULL means a remark exists without a level, or unassessed.';

CREATE INDEX IF NOT EXISTS idx_student_activity_journal_section_activity
  ON student_activity_journal (section_id, activity_id);

CREATE INDEX IF NOT EXISTS idx_student_activity_journal_student
  ON student_activity_journal (student_user_id);

CREATE INDEX IF NOT EXISTS idx_student_activity_journal_activity
  ON student_activity_journal (activity_id);

COMMIT;
