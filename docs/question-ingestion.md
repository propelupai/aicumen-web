# AICUMEN Question Ingestion Specification

**Status:** Draft for internal review  
**Scope:** Grade 6 integrated book packs (Books 1–4) + Grade 3 CT problem bank  
**Audience:** Content team, engineering, pilot schools  

---

## 1. Purpose

AICUMEN does **not** generate questions at runtime. Teachers select a topic; the platform serves **pre-authored** activities from an ingested question bank. The bank must support:

- Different **subjects** (Maths, English, Science, Social Studies)
- Different **activity shapes** within and across subjects
- Different **answer formats** (numeric, rubric, open-ended, multi-part)
- The **Socratic delivery layer** (ordered coach prompts), which is richer than what appears in the student workbooks

This document describes how source content is structured today, how it differs, what the **canonical platform representation** should be after normalization, and the **ingestion pipeline** to get there sustainably.

---

## 2. Source inventory

Each integrated pack ships as two `.docx` files:

| Pack | Student workbook | Teacher guide |
|------|------------------|---------------|
| Book 1 | AI in Maths | Teacher Guide and Solutions |
| Book 2 | AI and English | Teacher Guide and Solutions |
| Book 3 | AI and Science | Teacher Guide and Solutions |
| Book 4 | AI and Social Studies | Teacher Guide and Solutions |

Additional sources (not yet in the same format):

- **Grade 3 CT Problem Bank** (PDF): shorter, level-gated CT quests (e.g. Pattern Finder)
- **Prototype app data** (`AICUMEN_app.html`): hand-authored **Socratic coach ladders** per quest (5+ rungs with Ask / If stuck / Don't say)

**Important:** The workbooks provide **one nudge per activity**. The prototype's **multi-step coach array** is the product's live-session experience and is **not fully present** in the `.docx` files. Ingestion must treat these as two related but separate layers (see §5).

---

## 3. How source content is organized (common backbone)

Every pack follows the same high-level hierarchy:

```
Book
 └── Chapter (mapped to a CBSE anchor text)
      ├── Chapter metadata (big idea, CT move, AI concept, mastery targets)
      ├── Core activities (5–10 min "sparks")
      ├── Supplementary activities (practice set, labs, projects)
      └── Teacher-only material (solutions, misconceptions, pacing)
```

### 3.1 Chapter metadata (all subjects)

| Field | Maths (Book 1) | English (Book 2) | Science (Book 3) | Social Studies (Book 4) |
|-------|----------------|------------------|------------------|-------------------------|
| Anchor curriculum | Ganita Prakash Ch N | Poorvi unit + decimal Ch (e.g. 1.1) | Curiosity Ch N | SS chapter title |
| Chapter ID style | Integer `1`–`10` | Decimal `1.1`, `2.3` | Integer `1`–`12` | Integer |
| Big idea / mission | ✓ | ✓ ("Chapter mission") | ✓ | ✓ ("Learning targets") |
| CT move / skill | ✓ | ✓ | ✓ | ✓ |
| AI concept / link | ✓ | ✓ | ✓ | ✓ |
| Sports context | Woven into sparks | Explicit per chapter | Woven into sparks | Woven into sparks |
| Extra chapter fields | Mastery targets | Diagnostic Spark, Human insight | Mastery cycle, rubric levels | Civic / stakeholder framing |

### 3.2 Activity-level fields (student workbook)

Across subjects, each activity generally has:

| Source field | Example |
|--------------|---------|
| **Type label** | `Warm-Up`, `CT Challenge`, `Debug It`, … |
| **Title** | `Sequence Detective` |
| **Prompt** | `What to do:` / `Problem / exercise` / `Student prompt` |
| **Hint** | `AICUMEN nudge:` / `Hint:` |
| **Answer space** | Lines, table, or "Notes:" (workbook only; not stored as content) |

### 3.3 Teacher-only fields (teacher guide)

| Field | Purpose |
|-------|---------|
| **Answer / Suggested solution** | Model response or numeric result |
| **Teaching guidance / Facilitation move** | How to run Socratically |
| **Misconceptions + interventions** | Diagnostic support |
| **Mastery rubric** | What "good evidence" looks like |
| **Practice set answer key** | Per-problem solutions, often with "answers vary" guidance |

---

## 4. Structural variation across subjects

This is why a single rigid spreadsheet column set fails. Below is what actually differs.

### 4.1 Activity taxonomy by subject

**Maths (Book 1)** — most regular:

| Set | Types |
|-----|-------|
| Core Micro-Sparks (×6) | Warm-Up, CT Challenge, Sports Spark, Debug It, AI Connect, Exit Spark |
| Integrated Practice Set | P1–P6 (numbered practice problems) |
| Capstone | Mini Project, Portfolio Evidence |

**English (Book 2)** — different taxonomy:

| Set | Types |
|-----|-------|
| Diagnostic Spark | Standalone opener (not in Maths) |
| Micro-Spark Problems | Warm-Up, **AI Reading Lens**, Sports Spark, Debug It |
| Prompt, Write, Verify | **Prompt Lab**, **Writing Lab**, **Verification Check**, Exit Spark |
| Self-check | Tick-list rubric (portfolio metadata) |

English does **not** use `CT Challenge` / `AI Connect` labels; it splits reading vs writing vs verification.

**Science (Book 3)** — Maths-like core + lab framing:

| Set | Types |
|-----|-------|
| Micro-Sparks (×4–6) | Warm-Up, CT Challenge, Sports Spark, Debug It |
| Practice Set | Numbered problems with units / safety notes |
| Capstone | Mini Lab, Sports Science Micro-Investigation |

Answers often require **labels** (observation vs inference vs hypothesis) and **safety/ethics** checks.

**Social Studies (Book 4)** — civic reasoning emphasis:

| Set | Types |
|-----|-------|
| Core sparks (×6) | Same labels as Maths |
| Applied Data Lab | Route tables, scheduling, map exercises |
| Mastery Practice Set | Open civic questions with stakeholder framing |

Teacher solutions frequently use a **guidance template** rather than a single correct answer:

> "Suggested answer should use the chapter idea, identify relevant data or evidence, and include a fair human-review step where a decision affects people."

### 4.2 Answer format taxonomy

After reviewing all four teacher guides, answers fall into these **answer types**:

| `answer_type` | Description | Example subjects | Platform handling |
|---------------|-------------|------------------|-------------------|
| `numeric` | Single number or short calculation | Maths | Exact match optional; show model |
| `numeric_sequence` | List or table of numbers | Maths, Science | Structured comparison |
| `formula_rule` | Equation or rule in words | Maths | Text match + rubric |
| `pseudocode` | Numbered steps / algorithm | Maths, Science | Display only; no auto-grade |
| `classification` | Sort / label / tree | Science, SS | Partial credit via rubric |
| `short_text` | 1–3 sentences | All | Rubric keywords optional |
| `long_form` | Paragraph, dialogue, poem | English | Teacher-reviewed only |
| `open_rubric` | "Answers vary; look for…" | All, especially SS | Rubric checklist in `solution.rubric` |
| `multi_part` | (a), (b), (c) sub-answers | Maths, Science | Split into `parts[]` |
| `extend` | Stretch question for fast finishers | Prototype, some teacher guides | Optional coach rung |

**~40% of teacher answers** are explicitly open-ended ("answers vary", "many valid trees", "sample answer"). The platform must **not** assume gradable correctness for every row.

### 4.3 Structural differences summary

| Dimension | Variation |
|-----------|-----------|
| Chapter IDs | Integer vs decimal (`1.1`) |
| Activity type names | 6 shared labels + English-only + SS-only |
| Parts per chapter | 6 sparks + 6 practice vs English's dual blocks |
| Sub-questions | Rare in Maths sparks; common in Science practice |
| Coach depth | 1 nudge in book vs 5+ coach rungs in prototype |
| Multimodal hints | Prototype only (draw / table / clap / visualize) |

---

## 5. The real unit: questions, not activities

The first draft of this spec made a mistake: it put the **workbook activity** at the center (`activities.prompt` as a blob of text). That is a **curriculum packaging** unit, not what the product actually delivers.

What the teacher runs in a live session is a **problem** made of **questions**:

| Source concept | What it actually is |
|----------------|---------------------|
| Workbook "Warm-Up: Sequence Detective" | An **activity** (label + pacing + metadata) |
| "A cricket team scores 4, 8, 12, 16… Write the rule. Predict the 10th over." | One **stem question** (possibly 2–3 **sub-questions**) |
| "AICUMEN nudge: Compare each term with the over number" | A **scaffold hint** attached to a question |
| Teacher guide "Answer: rule = 4 × over number; 10th = 40" | An **answer spec** per sub-question |
| Prototype coach step "By how much does each jump grow?" | A **Socratic question** (`role: coach_step`) |
| "EXTEND: predict day 8" | A separate **question** (`role: extend`) |
| P1, P2, P3 in Integrated Practice Set | **Separate questions**, not one activity |

**Activities are folders. Questions are the content.**

### 5.1 Three layers (corrected)

```
┌──────────────────────────────────────────────────────────────┐
│  Layer A: Activity (workbook unit)                           │
│  - Warm-Up / CT Challenge / P3 / Prompt Lab                  │
│  - curriculum metadata only                                  │
│  - CONTAINS 1..N questions                                   │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│  Layer B: Questions (canonical core)                         │
│  - stem, sub-parts, extend                                   │
│  - each with typed answer_spec + optional hint               │
│  - INGESTED by parsing activity prompts                      │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│  Layer C: Socratic delivery (coach ladder)                   │
│  - ordered coach_step questions linked to the stem           │
│  - teacher_guidance, if_stuck, dont_say per step             │
│  - often authored separately from the workbook               │
└──────────────────────────────────────────────────────────────┘
```

The **board shows the stem question**. The **tablet shows coach questions** one at a time. Both are `questions` rows with different `role` values.

### 5.2 What counts as one question?

Ingestion must **split** source text into atomic questions. Rules:

| Source pattern | Canonical output |
|----------------|------------------|
| Single "What to do" sentence | 1× `stem` question |
| "(a) … (b) … (c) …" in one prompt | 1× `stem` + 3× `sub_part` questions (parent = stem) |
| Practice set P1, P2, … | N× separate `stem` questions, each under the same activity |
| Workbook nudge | `hint` on the relevant question (not a question row) |
| Coach ladder step | 1× `coach_step` question per rung |
| "EXTEND: …" | 1× `extend` question, child of stem |
| English "Complete: AI can help me when ____, but …" | 1× `stem` with `answer_type: fill_template` |

### 5.3 Question roles

| `role` | Shown to class? | Shown on teacher tablet? | Has gradable answer? |
|--------|-----------------|--------------------------|----------------------|
| `stem` | Yes (board) | Yes (context) | Usually yes |
| `sub_part` | Yes (as part of stem block) | Yes | Per part |
| `extend` | Optional (fast finishers) | Yes | Yes / rubric |
| `coach_step` | **No** (teacher asks aloud) | Yes (Prompt Coach) | No (guides thinking) |
| `workbook_only` | Worksheet | No | Varies |

---

## 6. Canonical platform schema (after normalization)

Recommended approach: **questions as first-class rows**, activities as grouping, JSONB only for edge-case payload.

### 6.1 Curriculum hierarchy

```
subjects
  id, slug, name, grade_min, grade_max

chapters
  id, subject_id, grade, chapter_code, title
  anchor_curriculum, anchor_reference
  metadata JSONB                    -- big_idea, mastery_targets

activities                          -- workbook packaging (NOT the question text)
  id, chapter_id, slug, title
  activity_type                     -- warm_up, practice, prompt_lab, …
  source_type_label
  sort_order, estimated_minutes
  ct_skills TEXT[], ai_concept TEXT
  status                            -- draft | review | published

questions                           -- *** CANONICAL CORE ***
  id, activity_id, parent_question_id NULLABLE
  role                              -- stem | sub_part | extend | coach_step
  sort_order
  label NULLABLE                    -- "a", "b", "P1", or coach step title
  stem TEXT NOT NULL                -- the actual question text
  context JSONB                     -- see §6.3
  hint TEXT NULLABLE                -- workbook nudge or if_stuck (role-dependent)
  delivery JSONB NULLABLE           -- multimodal variants (draw/table/clap/…)
  answer_spec JSONB NULLABLE        -- see §6.4; null for coach_step
  teacher_notes TEXT NULLABLE       -- facilitation move, dont_say (coach steps)

question_sources                    -- provenance per question
  question_id, source_book, source_file, raw_hash
```

**Session API** resolves a runnable problem as:

```
activity → questions WHERE role IN (stem, sub_part, extend)
        → questions WHERE role = coach_step ORDER BY sort_order
```

### 6.2 Activities vs questions: example

**Source (Book 1, Ch 1, CT Challenge):**

> What to do: Triangular numbers are 1, 3, 6, 10, 15, … **(a)** Find the rule. **(b)** If an AI sees only 1, 3, 6, what could go wrong? **(c)** What extra term would you add as test data?

**Canonical (3 question rows + 1 activity):**

```json
{
  "activity": {
    "id": "b1-g6-ch01-ct-challenge-ai-pattern-spotter",
    "activity_type": "ct_challenge",
    "title": "AI Pattern Spotter"
  },
  "questions": [
    {
      "id": "…-stem",
      "role": "stem",
      "sort_order": 0,
      "stem": "Triangular numbers are 1, 3, 6, 10, 15, …",
      "context": { "sequence": [1, 3, 6, 10, 15], "sports_context": null },
      "hint": "Look at the gaps: 2, 3, 4, 5, …"
    },
    {
      "id": "…-a",
      "role": "sub_part",
      "parent_question_id": "…-stem",
      "sort_order": 1,
      "label": "a",
      "stem": "Find the rule.",
      "answer_spec": {
        "answer_type": "formula_rule",
        "body": { "value": "Add 2, then 3, then 4… nth term adds n" }
      }
    },
    {
      "id": "…-b",
      "role": "sub_part",
      "parent_question_id": "…-stem",
      "sort_order": 2,
      "label": "b",
      "stem": "If an AI sees only 1, 3, 6, what could go wrong?",
      "answer_spec": {
        "answer_type": "open_rubric",
        "body": { "rubric": ["Many rules fit short data", "Model overfits"] }
      }
    },
    {
      "id": "…-c",
      "role": "sub_part",
      "parent_question_id": "…-stem",
      "sort_order": 3,
      "label": "c",
      "stem": "What extra term would you add as test data?",
      "answer_spec": {
        "answer_type": "open_rubric",
        "body": { "rubric": ["Term that rules out wrong patterns"], "examples": ["10", "15"] }
      }
    }
  ]
}
```

### 6.3 `questions.context` (structured problem data)

Parse numbers, entities, and constraints out of the stem instead of leaving them in prose:

```jsonc
{
  "theme": "Diwali Festival",           // prototype / Grade 3
  "sports_context": "cricket",
  "sequence": [1, 3, 6, 10, 15],
  "constraints": ["exactly 3 items", "total ₹40"],
  "entities": [
    { "name": "Idli", "price": 12 },
    { "name": "Samosa", "price": 8 }
  ],
  "given": "Messi scores 1, 2, 4, 7, 11 across 5 matches",
  "ask": "What comes next?"
}
```

This is what enables topic search ("pattern problems with sequences") and consistent board rendering.

### 6.4 `questions.answer_spec` (per question, not per activity)

Every `stem`, `sub_part`, and `extend` question gets its own typed answer. Coach steps do not.

| `answer_type` | Use when |
|---------------|----------|
| `numeric` | Single number |
| `numeric_sequence` | List / table of values |
| `formula_rule` | Rule in words or equation |
| `pseudocode` | Algorithm steps |
| `classification` | Sort / label / tree |
| `short_text` | 1–3 sentences |
| `long_form` | Paragraph, dialogue, poem |
| `fill_template` | "Complete: X when ____, but ____" |
| `open_rubric` | "Answers vary; look for…" |
| `none` | Coach steps only |

```jsonc
{
  "answer_type": "numeric",
  "body": { "value": "21", "unit": "stars" },
  "teaching_guidance": "Ask for the rule, not just the number.",
  "sample_answers": ["optional exemplar"],
  "misconceptions": ["Treating trend as guarantee"]
}
```

### 6.5 `questions.delivery` (multimodal run-it variants)

From the prototype / Grade 3 bank. Attached to the **stem**, not the activity:

```jsonc
{
  "draw": "Draw a growing rangoli…",
  "table": "Write the gaps under each pair…",
  "clap": "Clap 2, pause, clap 3…",
  "visualize": "Close your eyes and picture…",
  "active": "Hop a chalk number line on the floor…"
}
```

### 6.6 Coach ladder = `coach_step` questions

Prototype quest "Diya's Rangoli Stars" normalizes to **1 stem + 5 coach_step questions + 1 extend**:

```json
{
  "questions": [
    {
      "role": "stem",
      "stem": "Diya places stars across 5 days: 1, 3, 6, 10, 15. The rule is in the gaps. How many on day 6?",
      "context": { "sequence": [1, 3, 6, 10, 15], "theme": "Diwali" },
      "delivery": { "draw": "…", "clap": "…" },
      "answer_spec": { "answer_type": "numeric", "body": { "value": "21" } }
    },
    {
      "role": "coach_step",
      "sort_order": 1,
      "label": "Notice & Wonder",
      "stem": "What do you notice about these numbers? Don't answer yet.",
      "teacher_notes": "Collect 3–4 observations. Resist hinting.",
      "hint": "Look at two numbers next to each other.",
      "answer_spec": null
    },
    {
      "role": "coach_step",
      "sort_order": 2,
      "label": "Find the Gaps",
      "stem": "How much bigger is each number than the one before it?",
      "teacher_notes": "Key discovery moment. Have them say each gap aloud.",
      "hint": "What's 3 minus 1? Now 6 minus 3?",
      "answer_spec": null
    },
    {
      "role": "extend",
      "parent_question_id": "…-stem",
      "stem": "Predict day 8 without writing every term. What shortcut did you use?",
      "answer_spec": { "answer_type": "numeric", "body": { "value": "36" } }
    }
  ]
}
```

`teacher_notes` on coach steps combines facilitation guidance + **don't say** guardrails (or split into `dont_say` field if preferred).

### 6.7 Normalized `activity_type` enum

Map all subject-specific labels onto a shared enum:

| `activity_type` | Source labels |
|-----------------|---------------|
| `warm_up` | Warm-Up |
| `ct_challenge` | CT Challenge |
| `sports_spark` | Sports Spark |
| `debug_it` | Debug It |
| `ai_connect` | AI Connect |
| `exit_spark` | Exit Spark |
| `diagnostic` | Diagnostic Spark |
| `reading_lens` | AI Reading Lens |
| `prompt_lab` | Prompt Lab |
| `writing_lab` | Writing Lab |
| `verification` | Verification Check |
| `practice` | P1–Pn, Practice Set, Mastery Practice Set |
| `data_lab` | Applied Data Lab |
| `mini_project` | Mini Project, Mini Lab |
| `portfolio` | Portfolio Evidence, Self-check |

`source_type_label` preserves the original string for display and auditing.

### 6.8 Worked example: Sequence Detective (full question tree)

**Source:** Book 1, Ch 1, Warm-Up

**After ingestion → 1 activity + 4 questions:**

```json
{
  "activity": {
    "id": "b1-g6-ch01-warmup-sequence-detective",
    "activity_type": "warm_up",
    "title": "Sequence Detective",
    "ct_skills": ["pattern_recognition", "generalisation"],
    "ai_concept": "Recommendation systems and model limits"
  },
  "questions": [
    {
      "role": "stem",
      "sort_order": 0,
      "stem": "A cricket team scores 4, 8, 12, 16, … runs in successive overs.",
      "context": { "sequence": [4, 8, 12, 16], "sports_context": "cricket", "domain": "overs" },
      "hint": "Compare each term with the over number."
    },
    {
      "role": "sub_part",
      "label": "rule",
      "sort_order": 1,
      "stem": "Write the rule.",
      "answer_spec": {
        "answer_type": "formula_rule",
        "body": { "value": "score = 4 × over number" },
        "teaching_guidance": "Ask for arithmetic rule and real-world limitation."
      }
    },
    {
      "role": "sub_part",
      "label": "predict",
      "sort_order": 2,
      "stem": "Predict the 10th over score.",
      "answer_spec": {
        "answer_type": "numeric",
        "body": { "value": "40" }
      }
    },
    {
      "role": "sub_part",
      "label": "ai_use",
      "sort_order": 3,
      "stem": "How could an AI batting coach use this pattern?",
      "answer_spec": {
        "answer_type": "open_rubric",
        "body": {
          "rubric": ["Predict run rate", "Warn pattern may change with pitch or opponent"]
        }
      }
    }
  ]
}
```

Practice set items (P1–P6) each become **their own activity + single stem question**, not sub-parts of a shared stem.

---

## 7. Ingestion pipeline

### Stage 0: Source preparation

1. Content team exports `.docx` from the canonical Google Docs / Word masters.
2. Files land in a versioned folder: `sources/book1/v2026-06-01/`.
3. Each file gets a `content_version` tag (semver or date).

### Stage 1: Extract (deterministic)

```
.docx  →  raw text + structure hints
```

- Unzip `word/document.xml`, extract paragraphs and heading styles.
- Split on known anchors:
  - `Chapter N:` / `Chapter N.N:`
  - `Book1 Core Micro-Sparks`
  - `Integrated Practice Set`
  - `Solutions:` / `Teacher solution`
- Output: `extracted/{book}/{chapter}.json` (messy, lossy, but repeatable).

**Do not** treat this as final. Extraction captures text; structure inference is Stage 2.

### Stage 2: Parse → draft canonical JSON (LLM-assisted + rules)

Hybrid approach (recommended):

| Step | Method |
|------|--------|
| Chapter boundaries, activity titles | Rule-based (regex on headings) |
| Activity type classification | Rule-based map + fallback LLM |
| **Split prompt into question rows** | LLM + rules: detect (a)(b)(c), P1–Pn, EXTEND |
| **Extract `context`** (sequences, entities, constraints) | LLM from stem prose |
| Join teacher answer to each question | Rule-based on label / order |
| `answer_type` per question | LLM + rule overrides |
| `coach_step` questions | Authored separately or LLM-draft + review |

Each draft **question** includes:

```json
{
  "role": "sub_part",
  "stem": "Find the rule.",
  "answer_spec": { "answer_type": "formula_rule", "body": { "value": "..." } },
  "confidence": 0.92,
  "warnings": ["Split from compound prompt"],
  "source_span": { "file": "book1_student.docx", "activity": "CT Challenge" }
}
```

### Stage 3: Human review

Review UI (or spreadsheet export) shows:

- Side-by-side: source paragraph | parsed fields
- Flags: missing solution, ambiguous type, decimal chapter ID
- Actions: approve, edit, reject, mark "needs coach ladder"

**Gate:** Nothing writes to `published` without human approval.

### Stage 4: Load to database

```
approved JSON  →  upsert subjects, chapters, activities
              →  upsert questions (stem, sub_parts, coach_steps, extend)
              →  record question_sources hash for idempotent re-ingest
```

**Idempotency:** `slug` + `source_hash` determines insert vs update. Re-ingesting the same file with no content change is a no-op.

### Stage 5: Validate (automated)

| Check | Rule |
|-------|------|
| Required fields | Every question has `stem` + `role`; every activity has `activity_type` |
| Stem exists | Each runnable activity has ≥1 `stem` question |
| Answer pairing | Every `stem` / `sub_part` / `extend` has `answer_spec` (except coach) |
| Coach completeness | Warn if no `coach_step` rows for activities in live-coach pilot |
| Open answers | `open_rubric` must have non-empty `rubric` array |
| Split quality | Flag activities where prompt has (a)(b) but only one question row |

---

## 8. Mapping workbook → teacher guide

Student and teacher files are **paired by book + chapter + activity title**. Ingestion must **join** them:

```
Student: "1. Warm-Up: Sequence Detective" + "What to do: ..."
Teacher: "1. Warm-Up: Sequence Detective" + "Answer: ..." + "Teaching guidance: ..."
```

**Join keys (in priority order):**

1. `chapter_code` + `sort_order` + `activity_type`
2. Fuzzy match on `title` within chapter
3. Manual link in review UI when titles diverge

English is harder because student activities split across **Micro-Spark Problems** and **Prompt, Write, Verify** blocks; the teacher guide mirrors this but ordering must be preserved.

---

## 9. What the teacher app consumes

After normalization, the teacher dashboard queries:

```
GET /api/activities?subject=maths&grade=6&chapter=3
```

Response (simplified):

```json
{
  "chapter": { "title": "Number Play", "anchor": "Ganita Prakash Ch 3" },
  "activities": [
    {
      "id": "...",
      "title": "Supercell Spotter",
      "activity_type": "warm_up",
      "estimated_minutes": 7,
      "questions": {
        "stem": {
          "stem": "Cricket scores in one over are 4, 1, 6, 2, 6. A score is a supercell if greater than both neighbours. Mark the supercells.",
          "context": { "sequence": [4, 1, 6, 2, 6] },
          "hint": "End cells have only one neighbour."
        },
        "coach_steps": [
          { "label": "Notice & Wonder", "stem": "What do you notice?", "hint": "...", "teacher_notes": "..." }
        ],
        "sub_parts": [],
        "extend": null
      }
    }
  ]
}
```

**Live session:** board renders `questions.stem`; tablet walks `questions.coach_steps` in order.

**Observation journal** logs against `activity_id` + `question_id` (usually the stem) + mastery level (`answer` | `rule` | `teach`).

---

## 10. Recommended phasing

| Phase | Deliverable |
|-------|-------------|
| **P0** | Schema + ingest Book 1 (Maths) end-to-end; review UI; search by chapter |
| **P1** | Books 2–4 with `activity_type` mapping table; English dual-block parser |
| **P2** | Grade 3 problem bank; `coach_steps` + `multimodal` from prototype |
| **P3** | Coach ladder authoring workflow (draft from solution → human approve) |
| **P4** | Re-ingest on content version bump; diff report for editors |

---

## 11. Open decisions

1. **Coach ladder authoring:** Purely human, or LLM-draft-from-solution with mandatory review?
2. **Grade scope:** Store `grade` on chapter vs separate book editions per grade.
3. **Localization:** Hindi/Tamil chapter titles later; `prompt` may need `locale` column.
4. **Student app (Phase 2):** Same `activities` table or simplified subset?

---

## 12. Appendix: activity type mapping sheet

| Source label | `activity_type` | Typical `answer_type` |
|--------------|-----------------|-------------------------|
| Warm-Up | `warm_up` | `short_text`, `numeric` |
| CT Challenge | `ct_challenge` | `multi_part`, `pseudocode` |
| Sports Spark | `sports_spark` | `open_rubric` |
| Debug It | `debug_it` | `short_text` |
| AI Connect | `ai_connect` | `pseudocode`, `long_form` |
| Exit Spark | `exit_spark` | `open_rubric` |
| Diagnostic Spark | `diagnostic` | `short_text` |
| AI Reading Lens | `reading_lens` | `classification` |
| Prompt Lab | `prompt_lab` | `long_form` |
| Writing Lab | `writing_lab` | `long_form` |
| Verification Check | `verification` | `open_rubric` |
| P1–P6 / Practice | `practice` | varies |
| Applied Data Lab | `data_lab` | `numeric`, `open_rubric` |
| Mini Project / Lab | `mini_project` | `open_rubric` |

---

*Document version: 2026-07-07 · AICUMEN / PropelUpAI, Inc.*
