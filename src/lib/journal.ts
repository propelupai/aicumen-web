/**
 * Student observation journal — shared level ladder, labels, and helpers.
 * Levels are cumulative rungs: able_to_teach implies got_rule implies got_answer.
 */

export type JournalLevel = "got_answer" | "got_rule" | "able_to_teach";

export const JOURNAL_LEVELS: JournalLevel[] = ["got_answer", "got_rule", "able_to_teach"];

export const JOURNAL_LEVEL_RANK: Record<JournalLevel, number> = {
  got_answer: 1,
  got_rule: 2,
  able_to_teach: 3,
};

export type JournalLevelMeta = {
  key: JournalLevel;
  label: string;
  short: string;
  description: string;
  /** Tailwind classes for a selected pill/chip. */
  selectedClass: string;
  /** Tailwind classes for an unselected but available pill. */
  idleClass: string;
  /** Solid color for bars/heatmap cells. */
  barClass: string;
  /** Soft badge classes for read-only display. */
  badgeClass: string;
};

export const JOURNAL_LEVEL_META: Record<JournalLevel, JournalLevelMeta> = {
  got_answer: {
    key: "got_answer",
    label: "Got answer",
    short: "Answer",
    description: "Reached the correct answer",
    selectedClass: "bg-amber-500 text-white ring-amber-500",
    idleClass: "text-amber-800 ring-amber-200 hover:bg-amber-50",
    barClass: "bg-amber-400",
    badgeClass: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  },
  got_rule: {
    key: "got_rule",
    label: "Got rule",
    short: "Rule",
    description: "Articulated the underlying rule or pattern",
    selectedClass: "bg-sky-600 text-white ring-sky-600",
    idleClass: "text-sky-800 ring-sky-200 hover:bg-sky-50",
    barClass: "bg-sky-500",
    badgeClass: "bg-sky-50 text-sky-800 ring-1 ring-sky-200",
  },
  able_to_teach: {
    key: "able_to_teach",
    label: "Able to teach",
    short: "Teach",
    description: "Can explain or teach it to a peer",
    selectedClass: "bg-teal-600 text-white ring-teal-600",
    idleClass: "text-teal-800 ring-teal-200 hover:bg-teal-50",
    barClass: "bg-teal-500",
    badgeClass: "bg-teal-50 text-teal-800 ring-1 ring-teal-200",
  },
};

export function isJournalLevel(value: unknown): value is JournalLevel {
  return value === "got_answer" || value === "got_rule" || value === "able_to_teach";
}

export function journalLevelLabel(level: JournalLevel | null | undefined): string {
  return level ? JOURNAL_LEVEL_META[level].label : "Not assessed";
}

export type JournalLevelCounts = {
  got_answer: number;
  got_rule: number;
  able_to_teach: number;
  not_assessed: number;
};

export function emptyLevelCounts(): JournalLevelCounts {
  return { got_answer: 0, got_rule: 0, able_to_teach: 0, not_assessed: 0 };
}
