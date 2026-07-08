-- CBSE mandate compliance tagging, activity enrichment fields, and CT→lesson anchor links.
-- Supports AIQ_Demo_Question_Bank_Tagged.xlsx (Grade 6 constant) and future ingestion worker output.
-- Run after 005_seed_cbse_subjects.sql

BEGIN;

-- ---------------------------------------------------------------------------
-- Subject taxonomy (cbse_anchor vs ct_program)
-- ---------------------------------------------------------------------------
ALTER TABLE subjects
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'cbse_anchor';

UPDATE subjects SET kind = 'ct_program' WHERE slug = 'ct';

ALTER TABLE subjects DROP CONSTRAINT IF EXISTS chk_subjects_kind;
ALTER TABLE subjects
  ADD CONSTRAINT chk_subjects_kind
  CHECK (kind IN ('cbse_anchor', 'ct_program'));

-- ---------------------------------------------------------------------------
-- CBSE handbook mandate reference — GRADE-SPECIFIC (composite grade + code).
-- M1–M14 below are Grade 6 AI Facilitator Handbook items only (per your Excel).
-- Grades 3–5 (CT handbooks) and 7–8 (separate AI handbooks) get their own rows later.
-- See: https://cbseacademic.nic.in/ct-ai.html (per-grade teacher handbooks)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cbse_mandates (
  grade           SMALLINT NOT NULL,
  code            TEXT NOT NULL,
  handbook_item   TEXT NOT NULL,
  unit            TEXT,
  description     TEXT,
  handbook_track  TEXT NOT NULL DEFAULT 'ai_literacy',
  sort_order      SMALLINT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (grade, code),
  CONSTRAINT chk_cbse_mandates_grade CHECK (grade BETWEEN 1 AND 12),
  CONSTRAINT chk_cbse_mandates_track CHECK (
    handbook_track IN ('ct', 'ai_literacy', 'integrated')
  )
);

COMMENT ON TABLE cbse_mandates IS
  'Per-grade CBSE handbook checklist items for compliance coverage. Codes like M1 are scoped to a grade — not global.';

INSERT INTO cbse_mandates (grade, code, handbook_item, unit, handbook_track, sort_order) VALUES
  (6, 'M1',  'Human Intelligence',                               'Unit 1', 'ai_literacy',  1),
  (6, 'M2',  'What is Artificial Intelligence',                  'Unit 1', 'ai_literacy',  2),
  (6, 'M3',  'AI vs Automation',                                 'Unit 1', 'ai_literacy',  3),
  (6, 'M4',  'Recommendation Systems (YouTube)',                 'Unit 1', 'ai_literacy',  4),
  (6, 'M5',  'Digital Assistants (Alexa/Siri/Google Assistant)', 'Unit 1', 'ai_literacy',  5),
  (6, 'M6',  'Navigation Apps (Google Maps)',                    'Unit 1', 'ai_literacy',  6),
  (6, 'M7',  'Self-Driving Cars',                                'Unit 1', 'ai_literacy',  7),
  (6, 'M8',  'AI Fitness / Pose-Tracking Apps',                  'Unit 1', 'ai_literacy',  8),
  (6, 'M9',  'AI in Music (AI Duet)',                            'Unit 1', 'ai_literacy',  9),
  (6, 'M10', 'AI in Art (AutoDraw / style transfer)',            'Unit 1', 'ai_literacy', 10),
  (6, 'M11', 'Concept of the 3 AI Domains',                      'Unit 2', 'ai_literacy', 11),
  (6, 'M12', 'Computer Vision domain',                           'Unit 2', 'ai_literacy', 12),
  (6, 'M13', 'Natural Language Processing domain',               'Unit 2', 'ai_literacy', 13),
  (6, 'M14', 'Statistical Data domain',                          'Unit 2', 'ai_literacy', 14)
ON CONFLICT (grade, code) DO UPDATE SET
  handbook_item  = EXCLUDED.handbook_item,
  unit           = EXCLUDED.unit,
  handbook_track = EXCLUDED.handbook_track,
  sort_order     = EXCLUDED.sort_order,
  updated_at     = NOW();

-- ---------------------------------------------------------------------------
-- Activity ↔ mandate (many-to-many; mirrors Excel mandate_codes column)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_cbse_mandates (
  activity_id     INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  mandate_grade   SMALLINT NOT NULL,
  mandate_code    TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (activity_id, mandate_grade, mandate_code),
  FOREIGN KEY (mandate_grade, mandate_code)
    REFERENCES cbse_mandates (grade, code) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_activity_cbse_mandates_mandate
  ON activity_cbse_mandates (mandate_grade, mandate_code);

-- ---------------------------------------------------------------------------
-- CT-program quest → CBSE lesson anchor (for G3 bank + cross-subject discovery)
-- Integrated-book sparks use activities.chapter_id directly; this table is for
-- quests stored under subjects.slug = ct that map to a lesson the teacher taught.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_cbse_anchors (
  id                SERIAL PRIMARY KEY,
  activity_id       INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  subject_id        INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  grade             SMALLINT NOT NULL,
  chapter_id        INTEGER REFERENCES chapters(id) ON DELETE SET NULL,
  chapter_code      TEXT NOT NULL,
  chapter_title     TEXT NOT NULL,
  anchor_curriculum TEXT,
  anchor_reference  TEXT,
  match_strength    TEXT NOT NULL DEFAULT 'direct',
  topic_keywords    TEXT[] NOT NULL DEFAULT '{}',
  is_primary        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_activity_cbse_anchors_grade
    CHECK (grade BETWEEN 1 AND 12),
  CONSTRAINT chk_activity_cbse_anchors_match_strength
    CHECK (match_strength IN ('direct', 'thematic', 'stretch')),
  CONSTRAINT uq_activity_cbse_anchor
    UNIQUE (activity_id, subject_id, grade, chapter_code)
);

CREATE INDEX IF NOT EXISTS idx_activity_cbse_anchors_lookup
  ON activity_cbse_anchors (subject_id, grade, chapter_code);

CREATE INDEX IF NOT EXISTS idx_activity_cbse_anchors_chapter
  ON activity_cbse_anchors (chapter_id) WHERE chapter_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_cbse_anchors_keywords
  ON activity_cbse_anchors USING GIN (topic_keywords);

-- ---------------------------------------------------------------------------
-- Bulk ingest provenance (Excel, docx worker, etc.)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS content_ingest_batches (
  id            SERIAL PRIMARY KEY,
  source_label  TEXT NOT NULL UNIQUE,
  source_file   TEXT,
  source_kind   TEXT NOT NULL DEFAULT 'excel',
  row_count     INTEGER,
  notes         TEXT,
  ingested_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_content_ingest_batches_kind
    CHECK (source_kind IN ('excel', 'docx', 'worker', 'manual'))
);

-- ---------------------------------------------------------------------------
-- Activity fields for tagged sparks + enrichment pipeline
-- ---------------------------------------------------------------------------
ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS chapter_dependent BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS mastery_level TEXT,
  ADD COLUMN IF NOT EXISTS ingest_batch_id INTEGER REFERENCES content_ingest_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS enrichment_status TEXT NOT NULL DEFAULT 'raw';

CREATE UNIQUE INDEX IF NOT EXISTS uq_activities_external_id
  ON activities (external_id) WHERE external_id IS NOT NULL;

ALTER TABLE activities DROP CONSTRAINT IF EXISTS chk_activities_mastery_level;
ALTER TABLE activities
  ADD CONSTRAINT chk_activities_mastery_level
  CHECK (mastery_level IS NULL OR mastery_level IN (
    'beginning', 'developing', 'proficient', 'extending'
  ));

ALTER TABLE activities DROP CONSTRAINT IF EXISTS chk_activities_enrichment_status;
ALTER TABLE activities
  ADD CONSTRAINT chk_activities_enrichment_status
  CHECK (enrichment_status IN ('raw', 'enriching', 'enriched', 'failed'));

COMMENT ON COLUMN activities.external_id IS
  'Stable source key, e.g. AIQ-ENG-001 from tagged question bank.';
COMMENT ON COLUMN activities.chapter_dependent IS
  'FALSE = portable puzzle usable any day; TRUE = needs specific chapter context.';
COMMENT ON COLUMN activities.mastery_level IS
  'CBSE mastery ladder: beginning | developing | proficient | extending.';
COMMENT ON COLUMN activities.enrichment_status IS
  'raw = stem only from source; enriched = coach ladder + extend authored by ingestion worker.';

-- Widen activity_type for integrated-book + demo bank labels
ALTER TABLE activities DROP CONSTRAINT IF EXISTS chk_activities_type;
ALTER TABLE activities
  ADD CONSTRAINT chk_activities_type CHECK (
    activity_type IN (
      'quest', 'warm_up', 'ct_challenge', 'practice', 'prompt_lab',
      'debug_it', 'mini_lab', 'project',
      'probe', 'puzzle', 'ai_connect', 'exit_spark', 'sports_spark'
    )
  );

COMMIT;
