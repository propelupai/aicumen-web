-- Chapter topic search keywords + optional fuzzy search support.
-- Run after 008_seed_grade6_aiq_demo.sql
--
-- Teachers search colloquial terms ("fractions", "living things", "kites")
-- that may not appear verbatim in official CBSE chapter titles.
-- Safe to re-run: updates keywords by (subject slug, grade, chapter_code).

BEGIN;

-- Fuzzy match on chapter titles (typo-tolerant search). Requires superuser on some hosts;
-- skip or run separately if CREATE EXTENSION is restricted.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE chapters
  ADD COLUMN IF NOT EXISTS topic_keywords TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN chapters.topic_keywords IS
  'Teacher-facing search aliases: colloquial topic names, Poorvi story titles, NCERT shorthand, etc.';

CREATE INDEX IF NOT EXISTS idx_chapters_topic_keywords
  ON chapters USING GIN (topic_keywords);

CREATE INDEX IF NOT EXISTS idx_chapters_title_trgm
  ON chapters USING GIN (title gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Grade 6 · English (Poorvi anchors)
-- ---------------------------------------------------------------------------
UPDATE chapters c
   SET topic_keywords = ARRAY[
     'bottle of dew', 'dew', 'poorvi', 'english story', 'fable', 'moral story'
   ], updated_at = NOW()
  FROM subjects s
 WHERE c.subject_id = s.id AND s.slug = 'english'
   AND c.grade = 6 AND c.chapter_code = '1.1';

UPDATE chapters c
   SET topic_keywords = ARRAY[
     'raven and fox', 'raven', 'fox', 'fable', 'aesop', 'clever fox', 'poorvi'
   ], updated_at = NOW()
  FROM subjects s
 WHERE c.subject_id = s.id AND s.slug = 'english'
   AND c.grade = 6 AND c.chapter_code = '1.2';

UPDATE chapters c
   SET topic_keywords = ARRAY[
     'rama to the rescue', 'rama', 'rescue', 'ramayana', 'poorvi', 'story'
   ], updated_at = NOW()
  FROM subjects s
 WHERE c.subject_id = s.id AND s.slug = 'english'
   AND c.grade = 6 AND c.chapter_code = '1.3';

UPDATE chapters c
   SET topic_keywords = ARRAY[
     'the chair', 'chair', 'furniture', 'poorvi', 'short story'
   ], updated_at = NOW()
  FROM subjects s
 WHERE c.subject_id = s.id AND s.slug = 'english'
   AND c.grade = 6 AND c.chapter_code = '2.3';

UPDATE chapters c
   SET topic_keywords = ARRAY[
     'what a bird thought', 'bird', 'poem', 'poetry', 'poorvi', 'thought'
   ], updated_at = NOW()
  FROM subjects s
 WHERE c.subject_id = s.id AND s.slug = 'english'
   AND c.grade = 6 AND c.chapter_code = '3.2';

UPDATE chapters c
   SET topic_keywords = ARRAY[
     'change of heart', 'kindness', 'empathy', 'compassion', 'poorvi', 'story'
   ], updated_at = NOW()
  FROM subjects s
 WHERE c.subject_id = s.id AND s.slug = 'english'
   AND c.grade = 6 AND c.chapter_code = '4.1';

UPDATE chapters c
   SET topic_keywords = ARRAY[
     'yoga', 'way of life', 'health', 'wellness', 'mindfulness', 'exercise', 'poorvi'
   ], updated_at = NOW()
  FROM subjects s
 WHERE c.subject_id = s.id AND s.slug = 'english'
   AND c.grade = 6 AND c.chapter_code = '4.3';

UPDATE chapters c
   SET topic_keywords = ARRAY[
     'hamara bharat', 'incredible india', 'india', 'bharat', 'patriotism', 'poorvi'
   ], updated_at = NOW()
  FROM subjects s
 WHERE c.subject_id = s.id AND s.slug = 'english'
   AND c.grade = 6 AND c.chapter_code = '5.1';

UPDATE chapters c
   SET topic_keywords = ARRAY[
     'kites', 'kite', 'kite flying', 'festival', 'makar sankranti', 'poorvi'
   ], updated_at = NOW()
  FROM subjects s
 WHERE c.subject_id = s.id AND s.slug = 'english'
   AND c.grade = 6 AND c.chapter_code = '5.2';

UPDATE chapters c
   SET topic_keywords = ARRAY[
     'national war memorial', 'war memorial', 'soldiers', 'army', 'bravery', 'memorial', 'poorvi'
   ], updated_at = NOW()
  FROM subjects s
 WHERE c.subject_id = s.id AND s.slug = 'english'
   AND c.grade = 6 AND c.chapter_code = '5.4';

-- ---------------------------------------------------------------------------
-- Grade 6 · Social Studies
-- ---------------------------------------------------------------------------
UPDATE chapters c
   SET topic_keywords = ARRAY[
     'locating places', 'maps', 'map', 'globe', 'latitude', 'longitude', 'coordinates', 'earth'
   ], updated_at = NOW()
  FROM subjects s
 WHERE c.subject_id = s.id AND s.slug = 'social_studies'
   AND c.grade = 6 AND c.chapter_code = '1';

UPDATE chapters c
   SET topic_keywords = ARRAY[
     'landforms', 'mountains', 'rivers', 'plains', 'plateaus', 'geography', 'physical features'
   ], updated_at = NOW()
  FROM subjects s
 WHERE c.subject_id = s.id AND s.slug = 'social_studies'
   AND c.grade = 6 AND c.chapter_code = '3';

UPDATE chapters c
   SET topic_keywords = ARRAY[
     'timeline', 'history', 'historical sources', 'sources of history', 'archaeology', 'past'
   ], updated_at = NOW()
  FROM subjects s
 WHERE c.subject_id = s.id AND s.slug = 'social_studies'
   AND c.grade = 6 AND c.chapter_code = '4';

UPDATE chapters c
   SET topic_keywords = ARRAY[
     'india that is bharat', 'bharat', 'india name', 'constitution', 'republic'
   ], updated_at = NOW()
  FROM subjects s
 WHERE c.subject_id = s.id AND s.slug = 'social_studies'
   AND c.grade = 6 AND c.chapter_code = '5';

UPDATE chapters c
   SET topic_keywords = ARRAY[
     'cultural roots', 'culture', 'heritage', 'tradition', 'indian culture'
   ], updated_at = NOW()
  FROM subjects s
 WHERE c.subject_id = s.id AND s.slug = 'social_studies'
   AND c.grade = 6 AND c.chapter_code = '7';

UPDATE chapters c
   SET topic_keywords = ARRAY[
     'unity in diversity', 'diversity', 'pluralism', 'many in the one', 'secular'
   ], updated_at = NOW()
  FROM subjects s
 WHERE c.subject_id = s.id AND s.slug = 'social_studies'
   AND c.grade = 6 AND c.chapter_code = '8';

UPDATE chapters c
   SET topic_keywords = ARRAY[
     'local government', 'rural', 'panchayat', 'gram sabha', 'grassroots democracy', 'village'
   ], updated_at = NOW()
  FROM subjects s
 WHERE c.subject_id = s.id AND s.slug = 'social_studies'
   AND c.grade = 6 AND c.chapter_code = '11';

UPDATE chapters c
   SET topic_keywords = ARRAY[
     'local government', 'urban', 'municipality', 'mayor', 'grassroots democracy', 'city'
   ], updated_at = NOW()
  FROM subjects s
 WHERE c.subject_id = s.id AND s.slug = 'social_studies'
   AND c.grade = 6 AND c.chapter_code = '12';

UPDATE chapters c
   SET topic_keywords = ARRAY[
     'value of work', 'labour', 'labor', 'dignity of work', 'occupation', 'jobs'
   ], updated_at = NOW()
  FROM subjects s
 WHERE c.subject_id = s.id AND s.slug = 'social_studies'
   AND c.grade = 6 AND c.chapter_code = '13';

-- ---------------------------------------------------------------------------
-- Grade 6 · Science
-- ---------------------------------------------------------------------------
UPDATE chapters c
   SET topic_keywords = ARRAY[
     'wonderful world of science', 'science', 'scientific method', 'curiosity', 'observation'
   ], updated_at = NOW()
  FROM subjects s
 WHERE c.subject_id = s.id AND s.slug = 'science'
   AND c.grade = 6 AND c.chapter_code = '1';

UPDATE chapters c
   SET topic_keywords = ARRAY[
     'mindful eating', 'nutrition', 'healthy body', 'diet', 'food', 'balanced diet'
   ], updated_at = NOW()
  FROM subjects s
 WHERE c.subject_id = s.id AND s.slug = 'science'
   AND c.grade = 6 AND c.chapter_code = '3';

UPDATE chapters c
   SET topic_keywords = ARRAY[
     'magnets', 'magnetism', 'magnetic', 'poles', 'attract', 'repel'
   ], updated_at = NOW()
  FROM subjects s
 WHERE c.subject_id = s.id AND s.slug = 'science'
   AND c.grade = 6 AND c.chapter_code = '4';

UPDATE chapters c
   SET topic_keywords = ARRAY[
     'materials', 'matter', 'properties of materials', 'substances', 'objects around us'
   ], updated_at = NOW()
  FROM subjects s
 WHERE c.subject_id = s.id AND s.slug = 'science'
   AND c.grade = 6 AND c.chapter_code = '6';

UPDATE chapters c
   SET topic_keywords = ARRAY[
     'temperature', 'thermometer', 'heat', 'measurement', 'celsius', 'hot cold'
   ], updated_at = NOW()
  FROM subjects s
 WHERE c.subject_id = s.id AND s.slug = 'science'
   AND c.grade = 6 AND c.chapter_code = '7';

UPDATE chapters c
   SET topic_keywords = ARRAY[
     'living creatures', 'living things', 'life', 'plants', 'animals', 'characteristics of living'
   ], updated_at = NOW()
  FROM subjects s
 WHERE c.subject_id = s.id AND s.slug = 'science'
   AND c.grade = 6 AND c.chapter_code = '10';

UPDATE chapters c
   SET topic_keywords = ARRAY[
     'nature treasures', 'natural resources', 'conservation', 'environment', 'resources'
   ], updated_at = NOW()
  FROM subjects s
 WHERE c.subject_id = s.id AND s.slug = 'science'
   AND c.grade = 6 AND c.chapter_code = '11';

UPDATE chapters c
   SET topic_keywords = ARRAY[
     'beyond earth', 'space', 'solar system', 'planets', 'moon', 'astronomy', 'stars'
   ], updated_at = NOW()
  FROM subjects s
 WHERE c.subject_id = s.id AND s.slug = 'science'
   AND c.grade = 6 AND c.chapter_code = '12';

UPDATE chapters c
   SET topic_keywords = ARRAY[
     'ai literacy', 'artificial intelligence', 'ai domains', 'computer vision', 'nlp',
     'puzzle bank', 'portable', 'cross subject', 'sort the ai'
   ], updated_at = NOW()
  FROM subjects s
 WHERE c.subject_id = s.id AND s.slug = 'science'
   AND c.grade = 6 AND c.chapter_code = 'cross-subject-puzzle';

-- ---------------------------------------------------------------------------
-- Grade 6 · Maths
-- ---------------------------------------------------------------------------
UPDATE chapters c
   SET topic_keywords = ARRAY[
     'patterns', 'pattern', 'sequences', 'number patterns', 'mathematics patterns'
   ], updated_at = NOW()
  FROM subjects s
 WHERE c.subject_id = s.id AND s.slug = 'maths'
   AND c.grade = 6 AND c.chapter_code = '1';

UPDATE chapters c
   SET topic_keywords = ARRAY[
     'lines and angles', 'lines', 'angles', 'geometry', 'degrees', 'parallel', 'perpendicular'
   ], updated_at = NOW()
  FROM subjects s
 WHERE c.subject_id = s.id AND s.slug = 'maths'
   AND c.grade = 6 AND c.chapter_code = '2';

UPDATE chapters c
   SET topic_keywords = ARRAY[
     'number play', 'numbers', 'digits', 'fun with numbers', 'place value'
   ], updated_at = NOW()
  FROM subjects s
 WHERE c.subject_id = s.id AND s.slug = 'maths'
   AND c.grade = 6 AND c.chapter_code = '3';

UPDATE chapters c
   SET topic_keywords = ARRAY[
     'fractions', 'fraction', 'numerator', 'denominator', 'part whole', 'half', 'quarter'
   ], updated_at = NOW()
  FROM subjects s
 WHERE c.subject_id = s.id AND s.slug = 'maths'
   AND c.grade = 6 AND c.chapter_code = '7';

UPDATE chapters c
   SET topic_keywords = ARRAY[
     'constructions', 'compass', 'ruler', 'geometric construction', 'drawing shapes'
   ], updated_at = NOW()
  FROM subjects s
 WHERE c.subject_id = s.id AND s.slug = 'maths'
   AND c.grade = 6 AND c.chapter_code = '8';

UPDATE chapters c
   SET topic_keywords = ARRAY[
     'symmetry', 'mirror line', 'reflection', 'rangoli', 'symmetric shapes'
   ], updated_at = NOW()
  FROM subjects s
 WHERE c.subject_id = s.id AND s.slug = 'maths'
   AND c.grade = 6 AND c.chapter_code = '9';

UPDATE chapters c
   SET topic_keywords = ARRAY[
     'integers', 'negative numbers', 'zero', 'number line', 'other side of zero', 'signed numbers'
   ], updated_at = NOW()
  FROM subjects s
 WHERE c.subject_id = s.id AND s.slug = 'maths'
   AND c.grade = 6 AND c.chapter_code = '10';

UPDATE chapters c
   SET topic_keywords = ARRAY[
     'puzzle bank', 'water jug', 'matchstick', 'clap and continue', 'portable',
     'ct puzzle', 'cross chapter', 'algorithm', 'ai duet'
   ], updated_at = NOW()
  FROM subjects s
 WHERE c.subject_id = s.id AND s.slug = 'maths'
   AND c.grade = 6 AND c.chapter_code = 'cross-chapter-puzzle';

-- ---------------------------------------------------------------------------
-- Grade 3 · CT program (pilot)
-- ---------------------------------------------------------------------------
UPDATE chapters c
   SET topic_keywords = ARRAY[
     'pattern finder', 'patterns', 'level 3', 'diwali', 'number patterns', 'ct grade 3'
   ], updated_at = NOW()
  FROM subjects s
 WHERE c.subject_id = s.id AND s.slug = 'ct'
   AND c.grade = 3 AND c.chapter_code = 'L3';

COMMIT;
