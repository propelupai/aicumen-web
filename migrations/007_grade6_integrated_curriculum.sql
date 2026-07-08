-- Grade 6 integrated AIQ curriculum packs + raw ingest payload for enrichment worker.
-- Run after 006_cbse_mandates_and_activity_tagging.sql

BEGIN;

-- ---------------------------------------------------------------------------
-- Curriculum pack registry (integrated subject workbooks per grade)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS curriculum_packs (
  id            SERIAL PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,
  grade         SMALLINT NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_curriculum_packs_grade CHECK (grade BETWEEN 1 AND 12)
);

COMMENT ON TABLE curriculum_packs IS
  'Grade-level integrated curriculum offering (e.g. AIQ Grade 6 Maths/English/Science/SS workbooks).';

INSERT INTO curriculum_packs (slug, grade, title, description)
VALUES (
  'grade6_integrated_aiq',
  6,
  'Grade 6 Integrated AI & CT',
  'AIQ Grade 6 student workbooks and teacher guides — last 10–15 min sparks per CBSE chapter.'
)
ON CONFLICT (slug) DO UPDATE SET
  title       = EXCLUDED.title,
  description = EXCLUDED.description,
  updated_at  = NOW();

-- Optional PDF/docx references for in-app curriculum browser (populate separately)
CREATE TABLE IF NOT EXISTS curriculum_pack_assets (
  id            SERIAL PRIMARY KEY,
  pack_id       INTEGER NOT NULL REFERENCES curriculum_packs(id) ON DELETE CASCADE,
  subject_id    INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  asset_kind    TEXT NOT NULL,
  label         TEXT NOT NULL,
  storage_uri   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_curriculum_pack_assets_kind CHECK (
    asset_kind IN ('student_workbook', 'teacher_guide')
  ),
  CONSTRAINT uq_curriculum_pack_assets UNIQUE (pack_id, subject_id, asset_kind)
);

CREATE INDEX IF NOT EXISTS idx_curriculum_pack_assets_subject
  ON curriculum_pack_assets (subject_id);

-- ---------------------------------------------------------------------------
-- Raw source payload preserved for enrichment worker (Socratic branch, answer, etc.)
-- ---------------------------------------------------------------------------
ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS ingest_raw JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN activities.ingest_raw IS
  'Unprocessed source fields from Excel/docx ingest. Worker reads this to author coach_steps.';

-- Link chapters to curriculum pack via metadata (set by ingest script)
COMMENT ON COLUMN chapters.metadata IS
  'Chapter metadata: curriculum_pack slug, ct_move, poorvi/ganita anchor hints, etc.';

COMMIT;
