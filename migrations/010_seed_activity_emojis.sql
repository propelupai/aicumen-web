-- Per-activity display emojis (and accent colors) in activities.metadata.
-- Run after 008_seed_grade6_aiq_demo.sql
-- Updates by stable external_id — safe to re-run.

BEGIN;

-- Helper pattern:
--   metadata = jsonb_set(jsonb_set(metadata, '{emoji}', '"…"'::jsonb), '{accent}', '"…"'::jsonb)

-- ---------------------------------------------------------------------------
-- English (Poorvi · AI / NLP themes)
-- ---------------------------------------------------------------------------
UPDATE activities SET metadata = jsonb_set(jsonb_set(metadata, '{emoji}', '"💧"'::jsonb), '{accent}', '"teal"'::jsonb), updated_at = NOW() WHERE external_id = 'AIQ-ENG-001';
UPDATE activities SET metadata = jsonb_set(jsonb_set(metadata, '{emoji}', '"🦊"'::jsonb), '{accent}', '"teal"'::jsonb), updated_at = NOW() WHERE external_id = 'AIQ-ENG-002';
UPDATE activities SET metadata = jsonb_set(jsonb_set(metadata, '{emoji}', '"🛡️"'::jsonb), '{accent}', '"teal"'::jsonb), updated_at = NOW() WHERE external_id = 'AIQ-ENG-003';
UPDATE activities SET metadata = jsonb_set(jsonb_set(metadata, '{emoji}', '"🪑"'::jsonb), '{accent}', '"sky"'::jsonb), updated_at = NOW() WHERE external_id = 'AIQ-ENG-004';
UPDATE activities SET metadata = jsonb_set(jsonb_set(metadata, '{emoji}', '"🐦"'::jsonb), '{accent}', '"sky"'::jsonb), updated_at = NOW() WHERE external_id = 'AIQ-ENG-005';
UPDATE activities SET metadata = jsonb_set(jsonb_set(metadata, '{emoji}', '"💛"'::jsonb), '{accent}', '"amber"'::jsonb), updated_at = NOW() WHERE external_id = 'AIQ-ENG-006';
UPDATE activities SET metadata = jsonb_set(jsonb_set(metadata, '{emoji}', '"🧘"'::jsonb), '{accent}', '"teal"'::jsonb), updated_at = NOW() WHERE external_id = 'AIQ-ENG-007';
UPDATE activities SET metadata = jsonb_set(jsonb_set(metadata, '{emoji}', '"🪷"'::jsonb), '{accent}', '"amber"'::jsonb), updated_at = NOW() WHERE external_id = 'AIQ-ENG-008';
UPDATE activities SET metadata = jsonb_set(jsonb_set(metadata, '{emoji}', '"🪁"'::jsonb), '{accent}', '"sky"'::jsonb), updated_at = NOW() WHERE external_id = 'AIQ-ENG-009';
UPDATE activities SET metadata = jsonb_set(jsonb_set(metadata, '{emoji}', '"🎖️"'::jsonb), '{accent}', '"slate"'::jsonb), updated_at = NOW() WHERE external_id = 'AIQ-ENG-010';

-- ---------------------------------------------------------------------------
-- Social Studies
-- ---------------------------------------------------------------------------
UPDATE activities SET metadata = jsonb_set(jsonb_set(metadata, '{emoji}', '"🌍"'::jsonb), '{accent}', '"sky"'::jsonb), updated_at = NOW() WHERE external_id = 'AIQ-SOC-011';
UPDATE activities SET metadata = jsonb_set(jsonb_set(metadata, '{emoji}', '"⛰️"'::jsonb), '{accent}', '"amber"'::jsonb), updated_at = NOW() WHERE external_id = 'AIQ-SOC-012';
UPDATE activities SET metadata = jsonb_set(jsonb_set(metadata, '{emoji}', '"📜"'::jsonb), '{accent}', '"slate"'::jsonb), updated_at = NOW() WHERE external_id = 'AIQ-SOC-013';
UPDATE activities SET metadata = jsonb_set(jsonb_set(metadata, '{emoji}', '"🪷"'::jsonb), '{accent}', '"amber"'::jsonb), updated_at = NOW() WHERE external_id = 'AIQ-SOC-014';
UPDATE activities SET metadata = jsonb_set(jsonb_set(metadata, '{emoji}', '"🎭"'::jsonb), '{accent}', '"amber"'::jsonb), updated_at = NOW() WHERE external_id = 'AIQ-SOC-015';
UPDATE activities SET metadata = jsonb_set(jsonb_set(metadata, '{emoji}', '"🤝"'::jsonb), '{accent}', '"teal"'::jsonb), updated_at = NOW() WHERE external_id = 'AIQ-SOC-016';
UPDATE activities SET metadata = jsonb_set(jsonb_set(metadata, '{emoji}', '"🌾"'::jsonb), '{accent}', '"teal"'::jsonb), updated_at = NOW() WHERE external_id = 'AIQ-SOC-017';
UPDATE activities SET metadata = jsonb_set(jsonb_set(metadata, '{emoji}', '"🏙️"'::jsonb), '{accent}', '"sky"'::jsonb), updated_at = NOW() WHERE external_id = 'AIQ-SOC-018';
UPDATE activities SET metadata = jsonb_set(jsonb_set(metadata, '{emoji}', '"🔧"'::jsonb), '{accent}', '"slate"'::jsonb), updated_at = NOW() WHERE external_id = 'AIQ-SOC-019';

-- ---------------------------------------------------------------------------
-- Science
-- ---------------------------------------------------------------------------
UPDATE activities SET metadata = jsonb_set(jsonb_set(metadata, '{emoji}', '"🔬"'::jsonb), '{accent}', '"sky"'::jsonb), updated_at = NOW() WHERE external_id = 'AIQ-SCI-020';
UPDATE activities SET metadata = jsonb_set(jsonb_set(metadata, '{emoji}', '"🥗"'::jsonb), '{accent}', '"teal"'::jsonb), updated_at = NOW() WHERE external_id = 'AIQ-SCI-021';
UPDATE activities SET metadata = jsonb_set(jsonb_set(metadata, '{emoji}', '"🧲"'::jsonb), '{accent}', '"sky"'::jsonb), updated_at = NOW() WHERE external_id = 'AIQ-SCI-022';
UPDATE activities SET metadata = jsonb_set(jsonb_set(metadata, '{emoji}', '"🧪"'::jsonb), '{accent}', '"amber"'::jsonb), updated_at = NOW() WHERE external_id = 'AIQ-SCI-023';
UPDATE activities SET metadata = jsonb_set(jsonb_set(metadata, '{emoji}', '"🌡️"'::jsonb), '{accent}', '"amber"'::jsonb), updated_at = NOW() WHERE external_id = 'AIQ-SCI-024';
UPDATE activities SET metadata = jsonb_set(jsonb_set(metadata, '{emoji}', '"🏃"'::jsonb), '{accent}', '"teal"'::jsonb), updated_at = NOW() WHERE external_id = 'AIQ-SCI-025';
UPDATE activities SET metadata = jsonb_set(jsonb_set(metadata, '{emoji}', '"🐦"'::jsonb), '{accent}', '"slate"'::jsonb), updated_at = NOW() WHERE external_id = 'AIQ-SCI-026';
UPDATE activities SET metadata = jsonb_set(jsonb_set(metadata, '{emoji}', '"🪐"'::jsonb), '{accent}', '"sky"'::jsonb), updated_at = NOW() WHERE external_id = 'AIQ-SCI-027';
UPDATE activities SET metadata = jsonb_set(jsonb_set(metadata, '{emoji}', '"🤖"'::jsonb), '{accent}', '"slate"'::jsonb), updated_at = NOW() WHERE external_id = 'AIQ-SCI-028';

-- ---------------------------------------------------------------------------
-- Maths
-- ---------------------------------------------------------------------------
UPDATE activities SET metadata = jsonb_set(jsonb_set(metadata, '{emoji}', '"🔢"'::jsonb), '{accent}', '"teal"'::jsonb), updated_at = NOW() WHERE external_id = 'AIQ-MAT-029';
UPDATE activities SET metadata = jsonb_set(jsonb_set(metadata, '{emoji}', '"📐"'::jsonb), '{accent}', '"sky"'::jsonb), updated_at = NOW() WHERE external_id = 'AIQ-MAT-030';
UPDATE activities SET metadata = jsonb_set(jsonb_set(metadata, '{emoji}', '"📏"'::jsonb), '{accent}', '"sky"'::jsonb), updated_at = NOW() WHERE external_id = 'AIQ-MAT-031';
UPDATE activities SET metadata = jsonb_set(jsonb_set(metadata, '{emoji}', '"🔍"'::jsonb), '{accent}', '"amber"'::jsonb), updated_at = NOW() WHERE external_id = 'AIQ-MAT-032';
UPDATE activities SET metadata = jsonb_set(jsonb_set(metadata, '{emoji}', '"🥧"'::jsonb), '{accent}', '"teal"'::jsonb), updated_at = NOW() WHERE external_id = 'AIQ-MAT-033';
UPDATE activities SET metadata = jsonb_set(jsonb_set(metadata, '{emoji}', '"✏️"'::jsonb), '{accent}', '"sky"'::jsonb), updated_at = NOW() WHERE external_id = 'AIQ-MAT-034';
UPDATE activities SET metadata = jsonb_set(jsonb_set(metadata, '{emoji}', '"🪞"'::jsonb), '{accent}', '"amber"'::jsonb), updated_at = NOW() WHERE external_id = 'AIQ-MAT-035';
UPDATE activities SET metadata = jsonb_set(jsonb_set(metadata, '{emoji}', '"📊"'::jsonb), '{accent}', '"teal"'::jsonb), updated_at = NOW() WHERE external_id = 'AIQ-MAT-036';
UPDATE activities SET metadata = jsonb_set(jsonb_set(metadata, '{emoji}', '"🌤️"'::jsonb), '{accent}', '"sky"'::jsonb), updated_at = NOW() WHERE external_id = 'AIQ-MAT-037';
UPDATE activities SET metadata = jsonb_set(jsonb_set(metadata, '{emoji}', '"🫗"'::jsonb), '{accent}', '"slate"'::jsonb), updated_at = NOW() WHERE external_id = 'AIQ-MAT-038';
UPDATE activities SET metadata = jsonb_set(jsonb_set(metadata, '{emoji}', '"🖍️"'::jsonb), '{accent}', '"amber"'::jsonb), updated_at = NOW() WHERE external_id = 'AIQ-MAT-039';
UPDATE activities SET metadata = jsonb_set(jsonb_set(metadata, '{emoji}', '"🎵"'::jsonb), '{accent}', '"teal"'::jsonb), updated_at = NOW() WHERE external_id = 'AIQ-MAT-040';

COMMIT;
