-- AICUMEN core schema: schools, users, multi-tenant membership, simple RBAC,
-- academic structure (years → classes → sections), and enrollments.
--
-- Safe to run on a fresh database OR on top of the original bootstrap
-- (schools + users only). Uses IF NOT EXISTS / conditional ALTERs throughout.
--
-- Run once in Cloud SQL Studio (database: aicumen) or via psql.

BEGIN;

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Baseline tables (no-op if you already created these during infra setup)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schools (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  signup_code   TEXT NOT NULL UNIQUE,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS users (
  user_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid  TEXT UNIQUE,
  email         TEXT NOT NULL UNIQUE,
  display_name  TEXT,
  photo_url     TEXT,
  school_id     INTEGER REFERENCES schools(id) ON DELETE SET NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  role          TEXT NOT NULL DEFAULT 'member',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_school_id ON users(school_id);
CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);

-- ---------------------------------------------------------------------------
-- users: identity + global platform role (not per-school)
-- ---------------------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'teacher';

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS platform_role TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS username TEXT;

-- Student login handle (optional for teachers; required for students at app layer)
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_username_lower
  ON users (LOWER(username))
  WHERE username IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_account_type'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT chk_users_account_type
      CHECK (account_type IN ('teacher', 'student'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_platform_role'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT chk_users_platform_role
      CHECK (platform_role IS NULL OR platform_role = 'platform_admin');
  END IF;
END $$;

COMMENT ON COLUMN users.school_id IS
  'Active school for this session. All API routes scope resources to this id.';
COMMENT ON COLUMN users.account_type IS
  'teacher | student — which app surface and login path.';
COMMENT ON COLUMN users.platform_role IS
  'NULL for normal users. platform_admin = cross-school PropelUp staff.';
COMMENT ON COLUMN users.role IS
  'LEGACY: prefer user_schools.role_key for school-scoped permissions.';

-- ---------------------------------------------------------------------------
-- Multi-tenant membership + per-school RBAC (simple matrix; no permissions table)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_schools (
  user_id       UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  school_id     INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  role_key      TEXT NOT NULL DEFAULT 'teacher',
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, school_id),
  CONSTRAINT chk_user_schools_role_key
    CHECK (role_key IN ('teacher', 'school_admin', 'student'))
);

CREATE INDEX IF NOT EXISTS idx_user_schools_school_id ON user_schools(school_id);

COMMENT ON TABLE user_schools IS
  'Membership: which schools a user belongs to. role_key is the RBAC tier in that school.';
COMMENT ON COLUMN user_schools.role_key IS
  'teacher | school_admin | student — permissions resolved in app code (lib/rbac.ts).';

-- Backfill membership from existing users.school_id rows
INSERT INTO user_schools (user_id, school_id, role_key)
SELECT
  u.user_id,
  u.school_id,
  CASE
    WHEN u.account_type = 'student' THEN 'student'
    WHEN u.role IN ('school_admin', 'admin') THEN 'school_admin'
    ELSE 'teacher'
  END
FROM users u
WHERE u.school_id IS NOT NULL
  AND u.is_active = TRUE
ON CONFLICT (user_id, school_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Academic calendar
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS academic_years (
  id            SERIAL PRIMARY KEY,
  school_id     INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  label         TEXT NOT NULL,
  starts_on     DATE,
  ends_on       DATE,
  is_current    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_academic_years_school_label UNIQUE (school_id, label)
);

CREATE INDEX IF NOT EXISTS idx_academic_years_school_current
  ON academic_years(school_id, is_current)
  WHERE is_current = TRUE;

COMMENT ON TABLE academic_years IS
  'Per-school academic year (e.g. 2025-26). At most one is_current per school (enforced in app).';

-- ---------------------------------------------------------------------------
-- Classes (grade cohort) + sections (A, B, C…)
--
-- Indian CBSE framing:
--   class  = grade band at a school for a year (Class 6)
--   section = subdivision within that class (6-A, 6-B)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS classes (
  id                SERIAL PRIMARY KEY,
  school_id         INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  academic_year_id  INTEGER NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  grade             SMALLINT NOT NULL,
  name              TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_classes_grade CHECK (grade BETWEEN 1 AND 12),
  CONSTRAINT uq_classes_school_year_grade UNIQUE (school_id, academic_year_id, grade)
);

CREATE INDEX IF NOT EXISTS idx_classes_school_year ON classes(school_id, academic_year_id);

COMMENT ON TABLE classes IS
  'Grade cohort for a school in an academic year (e.g. Class 6, grade=6).';

CREATE TABLE IF NOT EXISTS sections (
  id            SERIAL PRIMARY KEY,
  class_id      INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  section_label TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_sections_label_nonempty CHECK (LENGTH(TRIM(section_label)) > 0),
  CONSTRAINT uq_sections_class_label UNIQUE (class_id, section_label)
);

CREATE INDEX IF NOT EXISTS idx_sections_class_id ON sections(class_id);

COMMENT ON TABLE sections IS
  'Section within a class (e.g. section_label=A, display_name=6-A).';

-- ---------------------------------------------------------------------------
-- Teacher ↔ section assignments (a teacher can cover multiple sections)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS class_teacher_assignments (
  user_id       UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  section_id    INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  is_primary    BOOLEAN NOT NULL DEFAULT FALSE,
  assigned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by   UUID REFERENCES users(user_id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, section_id)
);

CREATE INDEX IF NOT EXISTS idx_class_teacher_assignments_section
  ON class_teacher_assignments(section_id);

COMMENT ON TABLE class_teacher_assignments IS
  'Which teachers are assigned to which sections. is_primary = homeroom/class teacher.';

-- ---------------------------------------------------------------------------
-- Student ↔ section enrollment
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS student_enrollments (
  id            SERIAL PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  section_id    INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'active',
  enrolled_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  withdrawn_at  TIMESTAMPTZ,
  CONSTRAINT chk_student_enrollments_status
    CHECK (status IN ('active', 'transferred', 'withdrawn')),
  CONSTRAINT uq_student_enrollments_user_section UNIQUE (user_id, section_id)
);

-- One active section per student (transfer = withdraw old + new row, or update status)
CREATE UNIQUE INDEX IF NOT EXISTS uq_student_enrollments_one_active
  ON student_enrollments(user_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_student_enrollments_section
  ON student_enrollments(section_id)
  WHERE status = 'active';

COMMENT ON TABLE student_enrollments IS
  'Student placed in a section. Journal and quest progress can scope to section_id.';

-- ---------------------------------------------------------------------------
-- Helpful view: resolve section → school (for route guards)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW section_schools AS
SELECT
  s.id AS section_id,
  s.display_name AS section_display_name,
  c.id AS class_id,
  c.grade,
  c.school_id,
  c.academic_year_id,
  ay.label AS academic_year_label,
  ay.is_current AS academic_year_is_current
FROM sections s
JOIN classes c ON c.id = s.class_id
JOIN academic_years ay ON ay.id = c.academic_year_id;

COMMIT;
