-- Curriculum ingestion: source documents, processing status, RAG mappings,
-- curriculum tracks, section progress, and per-school curation.
-- Run after 002_curriculum_content.sql

BEGIN;

-- ---------------------------------------------------------------------------
-- Source document uploads (GCS object key = file_path)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS curriculum_documents (
  id            SERIAL PRIMARY KEY,
  title         TEXT NOT NULL,
  filename      TEXT NOT NULL,
  file_path     TEXT NOT NULL,
  subject_id    INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
  grade         SMALLINT,
  doc_kind      TEXT NOT NULL DEFAULT 'other',
  description   TEXT,
  uploaded_by   UUID REFERENCES users(user_id) ON DELETE SET NULL,
  file_size     INTEGER,
  mime_type     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_curriculum_documents_grade CHECK (grade IS NULL OR grade BETWEEN 1 AND 12),
  CONSTRAINT chk_curriculum_documents_kind CHECK (
    doc_kind IN ('student_workbook', 'teacher_guide', 'problem_bank', 'other')
  )
);

CREATE INDEX IF NOT EXISTS idx_curriculum_documents_subject_grade
  ON curriculum_documents(subject_id, grade);

CREATE INDEX IF NOT EXISTS idx_curriculum_documents_created
  ON curriculum_documents(created_at DESC);

COMMENT ON TABLE curriculum_documents IS
  'Platform-authored curriculum source files in GCS. file_path is the object key.';

-- ---------------------------------------------------------------------------
-- Ingestion status trail (worker updates; API reads latest via LATERAL)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS curriculum_document_processing (
  id              SERIAL PRIMARY KEY,
  document_id     INTEGER NOT NULL REFERENCES curriculum_documents(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'uploaded',
  doc_fingerprint TEXT NOT NULL DEFAULT '',
  error_message   TEXT,
  stats           JSONB NOT NULL DEFAULT '{}',
  processed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_curriculum_doc_processing_status CHECK (
    status IN ('uploaded', 'processing', 'ready_for_review', 'reviewed', 'failed')
  ),
  CONSTRAINT uq_curriculum_doc_processing_doc_fp UNIQUE (document_id, doc_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_curriculum_doc_processing_document
  ON curriculum_document_processing(document_id, updated_at DESC);

-- ---------------------------------------------------------------------------
-- Vertex RAG corpus mapping (one corpus per subject — worker-managed)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS curriculum_rag_corpora (
  subject_id        INTEGER PRIMARY KEY REFERENCES subjects(id) ON DELETE CASCADE,
  corpus_name       TEXT NOT NULL,
  display_name      TEXT NOT NULL,
  location          TEXT NOT NULL DEFAULT 'us-central1',
  embedding_model   TEXT NOT NULL DEFAULT 'text-embedding-005',
  status            TEXT NOT NULL DEFAULT 'active',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_curriculum_rag_corpora_status CHECK (status IN ('active', 'disabled'))
);

-- ---------------------------------------------------------------------------
-- RagFile mapping per uploaded document (worker-managed)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS curriculum_rag_files (
  document_id     INTEGER PRIMARY KEY REFERENCES curriculum_documents(id) ON DELETE CASCADE,
  subject_id      INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  corpus_name     TEXT NOT NULL,
  rag_file_name   TEXT NOT NULL,
  doc_fingerprint TEXT,
  status          TEXT NOT NULL DEFAULT 'indexed',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_curriculum_rag_files_status CHECK (
    status IN ('pending', 'indexed', 'failed', 'deleted')
  )
);

-- ---------------------------------------------------------------------------
-- Curriculum tracks (grade+subject OR CT level band)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS curriculum_tracks (
  id            SERIAL PRIMARY KEY,
  track_type    TEXT NOT NULL,
  subject_id    INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
  grade         SMALLINT,
  ct_level      SMALLINT,
  label         TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_curriculum_tracks_type CHECK (track_type IN ('grade_subject', 'ct_level')),
  CONSTRAINT chk_curriculum_tracks_grade CHECK (grade IS NULL OR grade BETWEEN 1 AND 12),
  CONSTRAINT chk_curriculum_tracks_ct_level CHECK (ct_level IS NULL OR ct_level BETWEEN 1 AND 5)
);

CREATE INDEX IF NOT EXISTS idx_curriculum_tracks_type
  ON curriculum_tracks(track_type, is_active);

-- ---------------------------------------------------------------------------
-- Section → track subscription (one active track per section)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS section_tracks (
  section_id    INTEGER PRIMARY KEY REFERENCES sections(id) ON DELETE CASCADE,
  track_id      INTEGER NOT NULL REFERENCES curriculum_tracks(id) ON DELETE RESTRICT,
  assigned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by   UUID REFERENCES users(user_id) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------------
-- Per-section activity progress (teacher/admin marks completion)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS section_activity_progress (
  id              SERIAL PRIMARY KEY,
  section_id      INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  activity_id     INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'not_started',
  completed_at    TIMESTAMPTZ,
  updated_by      UUID REFERENCES users(user_id) ON DELETE SET NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_section_activity_progress UNIQUE (section_id, activity_id),
  CONSTRAINT chk_section_activity_progress_status CHECK (
    status IN ('not_started', 'in_progress', 'completed', 'skipped')
  )
);

CREATE INDEX IF NOT EXISTS idx_section_activity_progress_section
  ON section_activity_progress(section_id);

-- ---------------------------------------------------------------------------
-- School-level curation (enable/disable + reorder without editing global catalog)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS school_content_settings (
  id              SERIAL PRIMARY KEY,
  school_id       INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  activity_id     INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  is_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  sort_override   INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_school_content_settings UNIQUE (school_id, activity_id)
);

CREATE INDEX IF NOT EXISTS idx_school_content_settings_school
  ON school_content_settings(school_id, is_enabled);

COMMIT;
