/** Grade 6 integrated AIQ curriculum — shared constants for API + ingest. */

export const GRADE6_INTEGRATED_PACK_SLUG = "grade6_integrated_aiq";
export const GRADE6_INTEGRATED_GRADE = 6;

/** Excel / workbook subject label → DB subjects.slug */
export const EXCEL_SUBJECT_TO_SLUG: Record<string, string> = {
  English: "english",
  Math: "maths",
  Maths: "maths",
  Science: "science",
  "Social Studies": "social_studies",
};

/** Workbook activity label → activities.activity_type */
export const WORKBOOK_ACTIVITY_TYPE_MAP: Record<string, string> = {
  "Warm-Up": "warm_up",
  "CT Challenge": "ct_challenge",
  "Sports Spark": "sports_spark",
  "Debug It": "debug_it",
  "AI Connect": "ai_connect",
  "Exit Spark": "exit_spark",
  Probe: "probe",
};

export function mapWorkbookActivityType(label: string): {
  activity_type: string;
  source_type_label: string;
} {
  const trimmed = label.trim();
  if (WORKBOOK_ACTIVITY_TYPE_MAP[trimmed]) {
    return {
      activity_type: WORKBOOK_ACTIVITY_TYPE_MAP[trimmed],
      source_type_label: trimmed,
    };
  }
  if (trimmed.toLowerCase().startsWith("puzzle:")) {
    return { activity_type: "puzzle", source_type_label: trimmed };
  }
  const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return { activity_type: slug || "practice", source_type_label: trimmed };
}

export function normalizeMasteryLevel(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  return raw.trim().toLowerCase();
}

export function parseCtSkills(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[/,]/)
    .map((s) =>
      s
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, ""),
    )
    .filter(Boolean);
}

export function parseMandateCodes(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^M\d+$/.test(c));
}

export function externalIdToSlug(externalId: string): string {
  return externalId.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function normalizeChapterCode(raw: string): string {
  const t = raw.trim();
  if (/^[\d.]+$/.test(t)) return t;
  return t
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
