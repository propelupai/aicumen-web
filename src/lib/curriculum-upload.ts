export const MAX_CURRICULUM_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export const CURRICULUM_ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
]);

export const CURRICULUM_ALLOWED_EXTENSIONS_LABEL = "PDF, DOCX, DOC, TXT";

export const CURRICULUM_DOC_KINDS = [
  "student_workbook",
  "teacher_guide",
  "problem_bank",
  "other",
] as const;

export type CurriculumDocKind = (typeof CURRICULUM_DOC_KINDS)[number];

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
