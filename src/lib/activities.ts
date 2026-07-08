export type ActivityAccent = "teal" | "sky" | "amber" | "slate";

export type ActivityMetadata = {
  quest_code?: string;
  theme?: string;
  difficulty?: string;
  stars?: number;
  emoji?: string;
  accent?: ActivityAccent;
};

export type ActivityListItem = {
  id: number;
  slug: string;
  title: string;
  quest_code: string;
  theme: string;
  skill: string;
  difficulty: string;
  stars: number;
  emoji: string;
  accent: ActivityAccent;
  coach_step_count: number;
  estimated_minutes: number;
  grade: number;
  chapter_title: string;
  chapter_code: string;
  anchor_curriculum?: string | null;
  subject_id?: number;
  subject_slug?: string;
  subject_name?: string;
  /** How this quest matched the teacher's lesson anchor */
  match_source?: "cbse_chapter" | "ct_program";
  activity_type?: string;
  enrichment_status?: string;
  chapter_dependent?: boolean;
  source_type_label?: string | null;
};

export type QuestionRow = {
  id: number;
  role: string;
  sort_order: number;
  label: string | null;
  stem: string;
  hint: string | null;
  context: Record<string, unknown>;
  delivery: Record<string, unknown> | null;
  answer_spec: Record<string, unknown> | null;
  teacher_notes: string | null;
};

export type ActivityDetail = ActivityListItem & {
  activity_type: string;
  ai_concept: string | null;
  ct_skills: string[];
  stem: QuestionRow | null;
  coach_steps: QuestionRow[];
  extend: QuestionRow | null;
};

export function parseActivityMetadata(raw: unknown): ActivityMetadata {
  if (!raw || typeof raw !== "object") return {};
  return raw as ActivityMetadata;
}

export function metadataToListFields(
  metadata: ActivityMetadata,
  ctSkills: string[],
): Pick<ActivityListItem, "quest_code" | "theme" | "difficulty" | "stars" | "emoji" | "accent" | "skill"> {
  return {
    quest_code: metadata.quest_code ?? "—",
    theme: metadata.theme ?? "General",
    difficulty: metadata.difficulty ?? "Medium",
    stars: metadata.stars ?? 2,
    emoji: metadata.emoji ?? "📘",
    accent: metadata.accent ?? "teal",
    skill: ctSkills[0]?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) ?? "Computational Thinking",
  };
}
