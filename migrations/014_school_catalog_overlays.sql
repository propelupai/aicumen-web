-- School catalog overlays: subject/chapter enable+reorder + school program prefs.
-- Does NOT modify global subjects/chapters/activities/questions content.
-- Run after 012_ai_program_subject.sql (AI subject exists for program prefs).

BEGIN;

-- ---------------------------------------------------------------------------
-- Per-school subject visibility / order
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_subject_settings (
  id              SERIAL PRIMARY KEY,
  school_id       INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  subject_id      INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  is_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  sort_override   INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_school_subject_settings UNIQUE (school_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_school_subject_settings_school
  ON school_subject_settings (school_id, is_enabled);

COMMENT ON TABLE school_subject_settings IS
  'School overlay: enable/disable and reorder subjects without editing the global catalog.';

-- ---------------------------------------------------------------------------
-- Per-school chapter / module visibility / order
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_chapter_settings (
  id              SERIAL PRIMARY KEY,
  school_id       INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  chapter_id      INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  is_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  sort_override   INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_school_chapter_settings UNIQUE (school_id, chapter_id)
);

CREATE INDEX IF NOT EXISTS idx_school_chapter_settings_school
  ON school_chapter_settings (school_id, is_enabled);

COMMENT ON TABLE school_chapter_settings IS
  'School overlay: enable/disable and reorder chapters/modules without editing the global catalog.';

-- ---------------------------------------------------------------------------
-- School-wide program preferences (CT / AI visibility + default track)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_preferences (
  school_id              INTEGER PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
  programs_ct_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  programs_ai_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  default_program_track  TEXT NOT NULL DEFAULT 'ct',
  metadata               JSONB NOT NULL DEFAULT '{}',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_school_preferences_track
    CHECK (default_program_track IN ('ct', 'ai'))
);

COMMENT ON TABLE school_preferences IS
  'School-wide prefs: which curriculum programs appear and the default CT/AI track.';

-- Seed prefs for existing schools (idempotent)
INSERT INTO school_preferences (school_id)
SELECT id FROM schools
ON CONFLICT (school_id) DO NOTHING;

COMMIT;
