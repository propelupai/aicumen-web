-- AI Literacy program subject (peer to Computational Thinking).
-- Grades 6–8: CT + AI. Grades 3–5: CT only (AI subject grade_min=6).
-- Run after 006_cbse_mandates_and_activity_tagging.sql

BEGIN;

ALTER TABLE subjects DROP CONSTRAINT IF EXISTS chk_subjects_kind;
ALTER TABLE subjects
  ADD CONSTRAINT chk_subjects_kind
  CHECK (kind IN ('cbse_anchor', 'ct_program', 'ai_program'));

INSERT INTO subjects (slug, name, grade_min, grade_max, kind)
VALUES ('ai', 'Artificial Intelligence', 6, 8, 'ai_program')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  grade_min = EXCLUDED.grade_min,
  grade_max = EXCLUDED.grade_max,
  kind = EXCLUDED.kind,
  updated_at = NOW();

UPDATE subjects
   SET kind = 'ct_program', updated_at = NOW()
 WHERE slug = 'ct' AND kind IS DISTINCT FROM 'ct_program';

COMMENT ON COLUMN subjects.kind IS
  'cbse_anchor = lesson subjects (Maths/English/…); ct_program = Computational Thinking bank; ai_program = AI Literacy bank';

COMMIT;
