#!/usr/bin/env python3
"""Generate migrations/008_seed_grade6_aiq_demo.sql from the tagged Excel. Run once locally."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
EXCEL = Path(r"C:\Users\arjun\Downloads\AIQ_Demo_Question_Bank_Tagged.xlsx")
OUT = ROOT / "migrations" / "008_seed_grade6_aiq_demo.sql"
SHEET = "Demo Question Bank v3"
GRADE = 6

SUBJECT_SLUG = {
    "English": "english",
    "Math": "maths",
    "Science": "science",
    "Social Studies": "social_studies",
}

ACTIVITY_TYPE = {
    "Warm-Up": "warm_up",
    "CT Challenge": "ct_challenge",
    "Sports Spark": "sports_spark",
    "Debug It": "debug_it",
    "AI Connect": "ai_connect",
    "Exit Spark": "exit_spark",
    "Probe": "probe",
}

COLS = {
    "external_id": "Question ID",
    "subject": "Subject",
    "chapter_code": "Chapter #",
    "chapter_title": "Chapter Title",
    "chapter_dependent": "Chapter-Dependent?",
    "activity_label": "Activity Type",
    "stem": "Question Text",
    "hint": "Hint / Nudge",
    "ct_skills": "CT Skill Tag(s)",
    "mandate_codes": "CBSE Mandate Code(s)",
    "difficulty": "Difficulty",
    "socratic_branch": "Socratic Branch (Teacher-Only)",
    "answer": "Answer / Solution (Teacher-Only)",
    "source": "Source",
}

COACH_LABELS = [
    "Notice & Wonder",
    "Think Together",
    "Probe Deeper",
    "Check & Defend",
    "Say the Idea",
]


def sql_str(s: str | None) -> str:
    if s is None:
        return "NULL"
    return "'" + str(s).replace("'", "''") + "'"


def sql_json(obj) -> str:
    return sql_str(json.dumps(obj, ensure_ascii=False))


def normalize_chapter_code(raw: str) -> str:
    t = (raw or "").strip()
    if re.match(r"^[\d.]+$", t):
        return t
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", t.lower())).strip("-")


def map_activity_type(label: str) -> tuple[str, str]:
    label = (label or "").strip()
    if label in ACTIVITY_TYPE:
        return ACTIVITY_TYPE[label], label
    if label.lower().startswith("puzzle:"):
        return "puzzle", label
    slug = re.sub(r"_+", "_", re.sub(r"[^a-z0-9]+", "_", label.lower())).strip("_")
    return slug or "practice", label


def parse_ct_skills(raw: str | None) -> list[str]:
    if not raw:
        return []
    out = []
    for p in re.split(r"[/,]", str(raw)):
        s = re.sub(r"_+", "_", re.sub(r"[^a-z0-9]+", "_", p.strip().lower())).strip("_")
        if s:
            out.append(s)
    return out


def parse_mandates(raw: str | None) -> list[str]:
    if not raw:
        return []
    return [c.strip().upper() for c in str(raw).split(",") if re.match(r"^M\d+$", c.strip(), re.I)]


def slugify(external_id: str) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", external_id.strip().lower())).strip("-")


def parse_socratic_branches(text: str | None) -> list[str]:
    if not text or not str(text).strip():
        return []
    raw = str(text).strip()
    parts = re.split(r"\s+If a student says\s+", raw, flags=re.I)
    chunks: list[str] = []
    if parts[0].strip():
        chunks.append(parts[0].strip())
    for p in parts[1:]:
        p = p.strip()
        if p:
            chunks.append("If a student says " + p)
    if len(chunks) <= 1:
        chunks = [c.strip() for c in re.split(r"\s+(?=\d+\.\s)|\n+", raw) if c.strip()]
    return chunks[:4]


def build_coach_steps(rec: dict, hint: str | None) -> list[dict]:
    socratic = str(rec.get("socratic_branch") or "").strip()
    branches = parse_socratic_branches(socratic)
    steps: list[dict] = []

    steps.append(
        {
            "label": COACH_LABELS[0],
            "stem": "What do you notice about this question? Don't answer yet — just look and think.",
            "hint": hint,
            "teacher_notes": "Collect 2–3 observations. Let students sit with the problem.",
        }
    )

    if branches:
        for i, branch in enumerate(branches):
            label = COACH_LABELS[min(i + 1, len(COACH_LABELS) - 1)]
            ask_match = re.search(r"ask:\s*[\"\u201c](.+?)[\"\u201d]", branch, re.I | re.S)
            stem = ask_match.group(1).strip() if ask_match else branch[:280]
            steps.append(
                {
                    "label": label,
                    "stem": stem,
                    "hint": hint if i == 0 else None,
                    "teacher_notes": branch if len(branch) <= 400 else branch[:400] + "...",
                }
            )
    else:
        steps.append(
            {
                "label": COACH_LABELS[1],
                "stem": "What is this question really asking you to figure out?",
                "hint": hint,
                "teacher_notes": "Help them restate the problem in their own words.",
            }
        )

    steps.append(
        {
            "label": COACH_LABELS[-1],
            "stem": "Explain your thinking so a friend could follow your reasoning.",
            "hint": None,
            "teacher_notes": "End on the reasoning process, not only the final claim.",
        }
    )

    # Cap at 5 coach steps for live session UX
    return steps[:5]


def build_extend(answer: str | None, chapter_title: str) -> dict | None:
    if not answer or not str(answer).strip():
        return None
    a = str(answer).strip()
    if len(a) < 12:
        return None
    return {
        "stem": f"Can you think of another example from {chapter_title} where the same idea applies?",
        "answer_spec": {"answer_type": "open_rubric", "body": {"rubric": [a]}},
    }


def read_rows(path: Path) -> list[dict]:
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb[SHEET]
    rows = list(ws.iter_rows(values_only=True))
    headers = [str(h).strip() if h else "" for h in rows[0]]
    idx = {name: headers.index(name) for name in COLS.values()}
    out = []
    for row in rows[1:]:
        if not any(c is not None and str(c).strip() for c in row):
            continue
        rec = {k: row[idx[v]] for k, v in COLS.items()}
        if rec.get("external_id"):
            out.append(rec)
    return out


def emit_activity(lines: list[str], rec: dict, sort_hint: int) -> None:
    ext = str(rec["external_id"]).strip()
    slug = slugify(ext)
    subject = str(rec["subject"]).strip()
    subject_slug = SUBJECT_SLUG[subject]
    chapter_code = normalize_chapter_code(str(rec["chapter_code"] or ""))
    chapter_title = str(rec["chapter_title"] or chapter_code).strip()
    chapter_dep = str(rec.get("chapter_dependent") or "Yes").strip().lower() == "yes"
    activity_type, source_label = map_activity_type(str(rec.get("activity_label") or ""))
    ct_skills = parse_ct_skills(rec.get("ct_skills"))
    mandates = parse_mandates(rec.get("mandate_codes"))
    mastery = str(rec.get("difficulty") or "").strip().lower() or None
    stem = str(rec.get("stem") or "").strip()
    hint = str(rec.get("hint") or "").strip() or None
    answer = str(rec.get("answer") or "").strip() or None
    source = str(rec.get("source") or "").strip() or None
    title = f"{source_label}: {chapter_title}"[:200]
    minutes = 10 if activity_type == "puzzle" else 15

    meta = {
        "quest_code": ext,
        "theme": chapter_title,
        "difficulty": str(rec.get("difficulty") or "Developing").strip(),
        "stars": 2,
        "emoji": "📘",
        "accent": "teal",
        "source": source,
    }
    ingest_raw = {
        "socratic_branch": str(rec.get("socratic_branch") or "").strip() or None,
        "answer": answer,
        "source": source,
        "excel_activity_label": source_label,
    }

    ct_array = "ARRAY[" + ",".join(sql_str(s) for s in ct_skills) + "]::text[]" if ct_skills else "ARRAY[]::text[]"

    lines.append(f"  -- {ext}: {title}")
    lines.append(f"  IF NOT EXISTS (SELECT 1 FROM activities WHERE slug = {sql_str(slug)}) THEN")
    lines.append("    SELECT c.id INTO ch_id")
    lines.append("      FROM chapters c")
    lines.append("      JOIN subjects s ON s.id = c.subject_id")
    lines.append(f"     WHERE s.slug = {sql_str(subject_slug)} AND c.chapter_code = {sql_str(chapter_code)};")
    lines.append("    IF ch_id IS NULL THEN")
    lines.append("      INSERT INTO chapters (subject_id, grade, chapter_code, title, metadata)")
    lines.append("      SELECT s.id, 6, " + sql_str(chapter_code) + ", " + sql_str(chapter_title) + ", ")
    lines.append("             " + sql_json({"curriculum_pack": "grade6_integrated_aiq"}) + "::jsonb")
    lines.append(f"        FROM subjects s WHERE s.slug = {sql_str(subject_slug)}")
    lines.append("      RETURNING id INTO ch_id;")
    lines.append("    END IF;")
    lines.append("")
    lines.append("    INSERT INTO activities (")
    lines.append("      chapter_id, slug, title, activity_type, source_type_label,")
    lines.append("      sort_order, estimated_minutes, ct_skills, status, metadata,")
    lines.append("      external_id, chapter_dependent, mastery_level, enrichment_status, ingest_raw")
    lines.append("    ) VALUES (")
    lines.append(f"      ch_id, {sql_str(slug)}, {sql_str(title)}, {sql_str(activity_type)}, {sql_str(source_label)},")
    lines.append(f"      {sort_hint}, {minutes}, {ct_array}, 'published', {sql_json(meta)}::jsonb,")
    lines.append(f"      {sql_str(ext)}, {str(chapter_dep).upper()}, {sql_str(mastery)}, 'enriched', {sql_json(ingest_raw)}::jsonb")
    lines.append("    ) RETURNING id INTO act_id;")
    lines.append("")

    answer_spec = {"answer_type": "short_text", "body": {"value": answer}} if answer else None
    lines.append("    INSERT INTO questions (activity_id, role, sort_order, stem, hint, answer_spec, context)")
    lines.append("    VALUES (")
    lines.append(f"      act_id, 'stem', 0, {sql_str(stem)}, {sql_str(hint)},")
    lines.append(f"      {sql_json(answer_spec) + '::jsonb' if answer_spec else 'NULL'},")
    lines.append(f"      {sql_json({'grade': GRADE, 'chapter_dependent': chapter_dep, 'external_id': ext})}::jsonb")
    lines.append("    ) RETURNING id INTO stem_id;")
    lines.append("")

    coach_steps = build_coach_steps(rec, hint)
    for i, step in enumerate(coach_steps, start=1):
        lines.append("    INSERT INTO questions (activity_id, role, sort_order, label, stem, hint, teacher_notes)")
        lines.append("    VALUES (")
        lines.append(
            f"      act_id, 'coach_step', {i}, {sql_str(step['label'])}, {sql_str(step['stem'])}, "
            f"{sql_str(step.get('hint'))}, {sql_str(step.get('teacher_notes'))}"
        )
        lines.append("    );")

    extend = build_extend(answer, chapter_title)
    if extend:
        lines.append("")
        lines.append("    INSERT INTO questions (activity_id, parent_question_id, role, sort_order, stem, answer_spec)")
        lines.append("    VALUES (")
        lines.append(
            f"      act_id, stem_id, 'extend', {len(coach_steps) + 1}, {sql_str(extend['stem'])}, "
            f"{sql_json(extend['answer_spec'])}::jsonb"
        )
        lines.append("    );")

    for code in mandates:
        lines.append("")
        lines.append("    INSERT INTO activity_cbse_mandates (activity_id, mandate_grade, mandate_code)")
        lines.append(f"    VALUES (act_id, 6, {sql_str(code)})")
        lines.append("    ON CONFLICT DO NOTHING;")

    lines.append("  END IF;")
    lines.append("")


def main() -> None:
    excel = EXCEL
    if len(sys.argv) > 1:
        excel = Path(sys.argv[1])
    if not excel.exists():
        raise SystemExit(f"Excel not found: {excel}")

    rows = read_rows(excel)
    lines: list[str] = [
        "-- Seed Grade 6 AIQ demo bank from AIQ_Demo_Question_Bank_Tagged.xlsx",
        "-- Idempotent. Run after 005, 006, 007.",
        "-- Step 1: map Excel rows to subjects/chapters/activities.",
        "-- Step 2: deterministic coach ladder (stem + coach_steps + optional extend). No LLM.",
        "",
        "BEGIN;",
        "",
        "INSERT INTO content_ingest_batches (source_label, source_file, source_kind, row_count, notes)",
        "VALUES (",
        "  'aiq_grade6_demo_excel_v1',",
        f"  {sql_str(str(excel))},",
        "  'excel',",
        f"  {len(rows)},",
        "  'Generated by scripts/generate_grade6_seed_sql.py'",
        ")",
        "ON CONFLICT (source_label) DO UPDATE SET",
        "  row_count = EXCLUDED.row_count,",
        "  ingested_at = NOW();",
        "",
        "DO $$",
        "DECLARE",
        "  ch_id INTEGER;",
        "  act_id INTEGER;",
        "  stem_id INTEGER;",
        "BEGIN",
        "",
    ]

    for i, rec in enumerate(rows, start=1):
        emit_activity(lines, rec, i)

    lines.extend(
        [
            "END $$;",
            "",
            "COMMIT;",
            "",
        ]
    )

    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {len(rows)} activities to {OUT}")


if __name__ == "__main__":
    main()
