# Curriculum ingestion worker output

The async worker (`curriculum-doc-requests` Pub/Sub topic) should normalize each quest/spark from uploaded teacher guides and workbooks into JSON matching:

**[curriculum-ingestion-output-schema.json](./curriculum-ingestion-output-schema.json)**

## Mapping to Postgres

| Worker output | DB table.column |
|---|---|
| `activity.*` | `activities` row (`status` = `review` until human approves) |
| `chapter.*` | Resolve or create `subjects` + `chapters` |
| `questions[]` where `role=stem` | One `questions` row |
| `questions[]` where `role=coach_step` | 4–6 rows, `sort_order` ascending |
| `questions[]` where `role=extend` | Optional one row, `parent_question_id` → stem |
| `questions[]` where `role=workbook_only` | Excluded from live session fetch |

## Reference seed

See [migrations/003_seed_grade3_quests.sql](../migrations/003_seed_grade3_quests.sql) for the canonical SQL insert pattern (Diya's Rangoli Stars).

## Worker flow

1. Read `curriculum_documents` row + GCS file
2. LLM extracts one `CurriculumIngestionOutput` object per spark/quest
3. Upsert `activities` + `questions` with `status = review`
4. Set `curriculum_document_processing.status = ready_for_review`
5. Platform admin reviews in Content Studio → publish

## Live session (Case 1)

No runtime LLM. Teacher runs quest via `GET /api/activities/:id` → pre-authored coach ladder.
