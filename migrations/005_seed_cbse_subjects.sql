-- CBSE integrated-book lesson subjects (Books 1–4 anchor hierarchy).
-- Computational Thinking lives separately as subjects.slug = 'ct' (CT program track / level bands).
-- Teachers map live quests FROM the CBSE lesson they taught, not by picking "CT" as a subject.
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
