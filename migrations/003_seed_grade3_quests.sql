-- Seed Grade 3 · Pattern Finder quest bank (pilot content from prototype).
-- Idempotent: safe to re-run (skips if slugs already exist).

BEGIN;

INSERT INTO subjects (slug, name, grade_min, grade_max)
VALUES ('ct', 'Computational Thinking', 3, 8)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO chapters (subject_id, grade, chapter_code, title, anchor_curriculum, metadata)
SELECT s.id, 3, 'L3', 'Level 3 · Pattern Finder', 'CBSE CT Grade 3',
       '{"level": 3, "level_name": "Pattern Finder"}'::jsonb
FROM subjects s WHERE s.slug = 'ct'
ON CONFLICT (subject_id, chapter_code) DO NOTHING;

-- Helper: only seed activities if not present
DO $$
DECLARE
  ch_id INTEGER;
  act_id INTEGER;
  stem_id INTEGER;
BEGIN
  SELECT c.id INTO ch_id
    FROM chapters c
    JOIN subjects s ON s.id = c.subject_id
   WHERE s.slug = 'ct' AND c.chapter_code = 'L3';

  IF ch_id IS NULL THEN
    RAISE EXCEPTION 'Chapter L3 not found — run subject/chapter inserts first';
  END IF;

  -- -------------------------------------------------------------------------
  -- L3-P1: Diya's Rangoli Stars
  -- -------------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM activities WHERE slug = 'diya-rangoli-stars') THEN
    INSERT INTO activities (
      chapter_id, slug, title, activity_type, source_type_label,
      sort_order, estimated_minutes, ct_skills, ai_concept, status, metadata
    ) VALUES (
      ch_id, 'diya-rangoli-stars', 'Diya''s Rangoli Stars', 'quest', 'Grade 3 Quest',
      1, 15, ARRAY['pattern_recognition'], 'Recommendation systems and model limits',
      'published',
      '{"quest_code":"L3-P1","theme":"Diwali Festival","difficulty":"Medium","stars":3,"emoji":"🪔","accent":"teal"}'::jsonb
    ) RETURNING id INTO act_id;

    INSERT INTO questions (activity_id, role, sort_order, stem, context, hint, delivery, answer_spec)
    VALUES (
      act_id, 'stem', 0,
      'Diya places stars in her rangoli across 5 days: 1, 3, 6, 10, 15. There''s a hidden rule in the gaps between the numbers. How many stars will she place on day 6?',
      '{"theme":"Diwali Festival","sequence":[1,3,6,10,15],"domain":"days","ask":"day 6 count"}'::jsonb,
      'Look at the gaps: 2, 3, 4, 5…',
      '{"draw":"Draw a growing rangoli. Start with 1 star, add 2 to get 3, add 3 to get 6…","table":"Write the gaps under each pair: 2, 3, 4, 5…","clap":"Clap 2, pause, clap 3, pause, clap 4…"}'::jsonb,
      '{"answer_type":"numeric","body":{"value":"21","unit":"stars"}}'::jsonb
    ) RETURNING id INTO stem_id;

    INSERT INTO questions (activity_id, parent_question_id, role, sort_order, label, stem, hint, teacher_notes) VALUES
      (act_id, NULL, 'coach_step', 1, 'Notice & Wonder', 'What do you notice about these numbers? Don''t answer yet — just look. What''s happening as they grow?', 'Look at two numbers next to each other. What''s 3 minus 1?', 'Collect 3–4 observations before moving on. Don''t say 21 yet.'),
      (act_id, NULL, 'coach_step', 2, 'Find the Gaps', 'How much bigger is each number than the one before it?', 'What''s 3 minus 1? Now 6 minus 3?', 'Have them say each gap aloud: 2, 3, 4, 5.'),
      (act_id, NULL, 'coach_step', 3, 'Spot the Rule', 'Look at the gaps: 2, 3, 4, 5. What''s the pattern in the GAPS themselves?', NULL, 'Push them to state: each gap grows by one.'),
      (act_id, NULL, 'coach_step', 4, 'Predict & Check', 'Using your rule — what''s the next gap, and how many stars on day 6?', 'Your next gap is 6. Start from 15 and add it.', 'Don''t confirm 21 too fast. Ask how they can be sure.'),
      (act_id, NULL, 'coach_step', 5, 'Say the Rule', 'Say the rule out loud so a friend could use it on any new pattern.', NULL, 'End on the RULE, not the number.');

    INSERT INTO questions (activity_id, parent_question_id, role, sort_order, stem, answer_spec)
    VALUES (
      act_id, stem_id, 'extend', 6,
      'Predict day 8 without writing every term. What shortcut did you use?',
      '{"answer_type":"numeric","body":{"value":"36"}}'::jsonb
    );
  END IF;

  -- -------------------------------------------------------------------------
  -- L3-P2: Rohan's Canteen Puzzle
  -- -------------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM activities WHERE slug = 'rohan-canteen-puzzle') THEN
    INSERT INTO activities (
      chapter_id, slug, title, activity_type, source_type_label,
      sort_order, estimated_minutes, ct_skills, ai_concept, status, metadata
    ) VALUES (
      ch_id, 'rohan-canteen-puzzle', 'Rohan''s Canteen Puzzle', 'quest', 'Grade 3 Quest',
      2, 15, ARRAY['decomposition'], 'Constraint satisfaction',
      'published',
      '{"quest_code":"L3-P2","theme":"School Canteen","difficulty":"Medium","stars":3,"emoji":"🍱","accent":"sky"}'::jsonb
    ) RETURNING id INTO act_id;

    INSERT INTO questions (activity_id, role, sort_order, stem, context, answer_spec)
    VALUES (
      act_id, 'stem', 0,
      'Rohan spends exactly ₹40 at the school canteen buying exactly 3 items. Idli ₹12 · Samosa ₹8 · Juice ₹20 · Biscuit ₹7. Which 3 did he buy?',
      '{"theme":"School Canteen","budget":40,"item_count":3,"prices":{"idli":12,"samosa":8,"juice":20,"biscuit":7}}'::jsonb,
      '{"answer_type":"short_text","body":{"value":"Idli + Samosa + Juice"}}'::jsonb
    ) RETURNING id INTO stem_id;

    INSERT INTO questions (activity_id, role, sort_order, label, stem, teacher_notes) VALUES
      (act_id, 'coach_step', 1, 'Read the Clues', 'What do we KNOW? What are we trying to FIND?', 'Separate known from unknown first.'),
      (act_id, 'coach_step', 2, 'One Item at a Time', 'Pick ONE item to start with. If he buys the juice (₹20), how much is left?', 'Fix one item, then the problem shrinks.'),
      (act_id, 'coach_step', 3, 'Search Smartly', 'With ₹20 left for 2 items, which two add to ₹20?', NULL),
      (act_id, 'coach_step', 4, 'Check the Answer', 'Add them up — is it exactly 3 items AND exactly ₹40?', 'Make them prove BOTH clues.'),
      (act_id, 'coach_step', 5, 'Is It the Only Way?', 'Is there any OTHER set of 3 items that makes ₹40?', 'Let them check and conclude.');

    INSERT INTO questions (activity_id, parent_question_id, role, sort_order, stem, answer_spec)
    VALUES (
      act_id, stem_id, 'extend', 6,
      'Is there any OTHER set of 3 items that totals exactly ₹40? How can you be sure?',
      '{"answer_type":"open_rubric","body":{"rubric":["Only Idli+Samosa+Juice works"]}}'::jsonb
    );
  END IF;

  -- -------------------------------------------------------------------------
  -- L3-P3: Aarav's Clay Cube
  -- -------------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM activities WHERE slug = 'aarav-clay-cube') THEN
    INSERT INTO activities (
      chapter_id, slug, title, activity_type, source_type_label,
      sort_order, estimated_minutes, ct_skills, ai_concept, status, metadata
    ) VALUES (
      ch_id, 'aarav-clay-cube', 'Aarav''s Clay Cube', 'quest', 'Grade 3 Quest',
      3, 15, ARRAY['abstract_thinking'], 'Visual inference limits',
      'published',
      '{"quest_code":"L3-P3","theme":"Art Class","difficulty":"Hard","stars":3,"emoji":"🎨","accent":"amber"}'::jsonb
    ) RETURNING id INTO act_id;

    INSERT INTO questions (activity_id, role, sort_order, stem, context, answer_spec)
    VALUES (
      act_id, 'stem', 0,
      'Aarav sculpts a perfect cube from clay. His teacher photographs it from the top and sees a square. From the front she also sees a square. Aarav says: the side view must look different! Is Aarav right?',
      '{"theme":"Art Class","shape":"cube"}'::jsonb,
      '{"answer_type":"short_text","body":{"value":"No — all three views are squares"}}'::jsonb
    ) RETURNING id INTO stem_id;

    INSERT INTO questions (activity_id, role, sort_order, label, stem, teacher_notes) VALUES
      (act_id, 'coach_step', 1, 'Picture the Cube', 'What shape is a cube? How many faces?', NULL),
      (act_id, 'coach_step', 2, 'Top View', 'If you look straight down, what do you see?', NULL),
      (act_id, 'coach_step', 3, 'Front View', 'If you look from the front, what do you see?', NULL),
      (act_id, 'coach_step', 4, 'Side View', 'Now predict the side. Same or different?', 'Don''t confirm yet — let them draw it.'),
      (act_id, 'coach_step', 5, 'Defend Your View', 'Can you explain why Aarav is right or wrong?', NULL);

    INSERT INTO questions (activity_id, parent_question_id, role, sort_order, stem, answer_spec)
    VALUES (
      act_id, stem_id, 'extend', 6,
      'Name a 3D shape where top and front look the same but the side looks different.',
      '{"answer_type":"open_rubric","body":{"rubric":["e.g. rectangular prism"]}}'::jsonb
    );
  END IF;

  -- -------------------------------------------------------------------------
  -- L3-P4: Cricket League Table
  -- -------------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM activities WHERE slug = 'cricket-league-table') THEN
    INSERT INTO activities (
      chapter_id, slug, title, activity_type, source_type_label,
      sort_order, estimated_minutes, ct_skills, ai_concept, status, metadata
    ) VALUES (
      ch_id, 'cricket-league-table', 'Cricket League Table', 'quest', 'Grade 3 Quest',
      4, 15, ARRAY['algorithmic_thinking'], 'Sorting with tie-breakers',
      'published',
      '{"quest_code":"L3-P4","theme":"IPL Season","difficulty":"Medium","stars":2,"emoji":"🏏","accent":"slate"}'::jsonb
    ) RETURNING id INTO act_id;

    INSERT INTO questions (activity_id, role, sort_order, stem, context, answer_spec)
    VALUES (
      act_id, 'stem', 0,
      'Four teams play a school cricket league. Rank them: wins first, then run-rate if wins are tied. Delhi (3W, 8.2 RR) · Mumbai (5W, 7.4 RR) · Chennai (3W, 9.1 RR) · Kolkata (7W, 6.8 RR).',
      '{"theme":"IPL Season","teams":[{"name":"Delhi","wins":3,"rr":8.2},{"name":"Mumbai","wins":5,"rr":7.4},{"name":"Chennai","wins":3,"rr":9.1},{"name":"Kolkata","wins":7,"rr":6.8}]}'::jsonb,
      '{"answer_type":"open_rubric","body":{"value":"Kolkata, Mumbai, Chennai, Delhi"}}'::jsonb
    ) RETURNING id INTO stem_id;

    INSERT INTO questions (activity_id, role, sort_order, label, stem, teacher_notes) VALUES
      (act_id, 'coach_step', 1, 'Read the Rule', 'What are the TWO parts of the ranking rule?', 'Wins first, then run-rate.'),
      (act_id, 'coach_step', 2, 'Sort by Wins', 'Put the teams in order of wins. Who is on top?', 'Surface the Chennai/Delhi tie.'),
      (act_id, 'coach_step', 3, 'Break the Tie', 'Chennai and Delhi both have 3 wins. Now use run-rate.', NULL),
      (act_id, 'coach_step', 4, 'Final Ranking', 'Give the 1-2-3-4 ranking with the REASON for each.', 'Push for reasoning, not just the list.'),
      (act_id, 'coach_step', 5, 'Change the Rule', 'What if the rule was most runs scored — would the order change?', NULL);

    INSERT INTO questions (activity_id, parent_question_id, role, sort_order, stem, answer_spec)
    VALUES (
      act_id, stem_id, 'extend', 6,
      'The rule changes to most runs scored: Kolkata 480, Mumbai 390, Chennai 420, Delhi 350. Does the order change?',
      '{"answer_type":"open_rubric","body":{"value":"Yes — Mumbai drops to 3rd"}}'::jsonb
    );
  END IF;

END $$;

COMMIT;
