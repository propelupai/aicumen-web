-- CBSE integrated-book subjects (Books 1–4) + existing CT subject.
-- Run after 002_curriculum_content.sql. Safe to re-run.

BEGIN;

INSERT INTO subjects (slug, name, grade_min, grade_max)
VALUES
  ('maths', 'Maths', 3, 8),
  ('english', 'English', 3, 8),
  ('science', 'Science', 3, 8),
  ('social_studies', 'Social Studies', 3, 8)
ON CONFLICT (slug) DO NOTHING;

COMMIT;
