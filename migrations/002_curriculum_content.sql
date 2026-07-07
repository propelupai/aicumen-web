-- Curriculum content: subjects → chapters → activities → questions
-- Run after 001_schools_users_tenancy_rbac_classes.sql

BEGIN;

-- ---------------------------------------------------------------------------
-- subjects
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subjects (
  id          SERIAL PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  grade_min   SMALLINT NOT NULL DEFAULT 3,
  grade_max   SMALLINT NOT NULL DEFAULT 8,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_subjects_grades CHECK (grade_min <= grade_max)
);

-- ---------------------------------------------------------------------------
-- chapters (CBSE anchor unit or CT level band)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chapters (
  id                SERIAL PRIMARY KEY,
  subject_id        INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  grade             SMALLINT NOT NULL,
  chapter_code      TEXT NOT NULL,
  title             TEXT NOT NULL,
  anchor_curriculum TEXT,
  anchor_reference  TEXT,
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_chapters_subject_code UNIQUE (subject_id, chapter_code)
);

CREATE INDEX IF NOT EXISTS idx_chapters_subject_grade ON chapters(subject_id, grade);

-- ---------------------------------------------------------------------------
-- activities (quest / spark packaging — what teachers pick)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activities (
  id                  SERIAL PRIMARY KEY,
  chapter_id          INTEGER NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  slug                TEXT NOT NULL UNIQUE,
  title               TEXT NOT NULL,
  activity_type       TEXT NOT NULL DEFAULT 'quest',
  source_type_label   TEXT,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  estimated_minutes   SMALLINT NOT NULL DEFAULT 15,
  ct_skills           TEXT[] NOT NULL DEFAULT '{}',
  ai_concept          TEXT,
  status              TEXT NOT NULL DEFAULT 'draft',
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_activities_status CHECK (status IN ('draft', 'review', 'published')),
  CONSTRAINT chk_activities_type CHECK (
    activity_type IN (
      'quest', 'warm_up', 'ct_challenge', 'practice', 'prompt_lab',
      'debug_it', 'mini_lab', 'project'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_activities_chapter ON activities(chapter_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_activities_status ON activities(status) WHERE status = 'published';

COMMENT ON COLUMN activities.metadata IS
  'Display + pilot fields: quest_code, theme, difficulty, stars, emoji, accent';

-- ---------------------------------------------------------------------------
-- questions (canonical core)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS questions (
  id                  SERIAL PRIMARY KEY,
  activity_id         INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  parent_question_id  INTEGER REFERENCES questions(id) ON DELETE CASCADE,
  role                TEXT NOT NULL,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  label               TEXT,
  stem                TEXT NOT NULL,
  context             JSONB NOT NULL DEFAULT '{}',
  hint                TEXT,
  delivery            JSONB,
  answer_spec         JSONB,
  teacher_notes       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_questions_role CHECK (
    role IN ('stem', 'sub_part', 'extend', 'coach_step', 'workbook_only')
  )
);

CREATE INDEX IF NOT EXISTS idx_questions_activity ON questions(activity_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_questions_parent ON questions(parent_question_id);
CREATE INDEX IF NOT EXISTS idx_questions_activity_role ON questions(activity_id, role);

COMMIT;
