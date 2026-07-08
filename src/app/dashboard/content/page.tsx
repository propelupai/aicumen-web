"use client";

import { FormEvent, useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  CheckCircle2,
  FileUp,
  FolderTree,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { CURRICULUM_DOC_KINDS } from "@/lib/curriculum-upload";
import { CoachReviewPanel } from "@/components/coach-review-panel";

type PlatformTab = "documents" | "catalog" | "review";
type SchoolTab = "curation" | "tracks" | "progress";

type CurriculumDocument = {
  id: number;
  title: string;
  filename: string;
  doc_kind: string;
  grade: number | null;
  subject_name: string | null;
  processing_status: string | null;
  processing_error: string | null;
  is_ingested: boolean;
  file_url: string;
  created_at: string;
};

type SubjectRow = {
  id: number;
  name: string;
  slug: string;
  grade_min: number;
  grade_max: number;
  chapter_count: number;
};

type ChapterRow = {
  id: number;
  subject_id: number;
  grade: number;
  chapter_code: string;
  title: string;
  activity_count: number;
};

type ActivityRow = {
  id: number;
  title: string;
  slug: string;
  status: string;
  chapter_code: string;
  chapter_title: string;
  grade: number;
  subject_name: string;
  question_count: number;
};

type ReviewItem = ActivityRow;

type SchoolActivity = {
  id: number;
  title: string;
  chapter_code: string;
  chapter_title: string;
  grade: number;
  subject_name: string;
  is_enabled: boolean;
};

type TrackRow = {
  id: number;
  label: string;
  track_type: string;
  subject_name: string | null;
  grade: number | null;
  ct_level: number | null;
};

type SectionRow = {
  id: number;
  display_name: string;
  grade: number;
  track_id: number | null;
  track_label: string | null;
};

const DOC_KIND_LABELS: Record<string, string> = {
  student_workbook: "Student workbook",
  teacher_guide: "Teacher guide",
  problem_bank: "Problem bank",
  other: "Other",
};

const STATUS_STYLES: Record<string, string> = {
  uploaded: "bg-slate-100 text-slate-700",
  processing: "bg-amber-100 text-amber-800",
  ready_for_review: "bg-sky-100 text-sky-800",
  reviewed: "bg-teal-100 text-teal-800",
  failed: "bg-red-100 text-red-800",
  draft: "bg-slate-100 text-slate-700",
  review: "bg-amber-100 text-amber-800",
  published: "bg-teal-100 text-teal-800",
};

const STATUS_LABELS: Record<string, string> = {
  uploaded: "Uploaded",
  processing: "Processing",
  ready_for_review: "Ready for review",
  reviewed: "Reviewed",
  failed: "Failed",
  draft: "Draft",
  review: "In review",
  published: "Published",
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
  skipped: "Skipped",
};

function StatusBadge({ status }: { status: string | null }) {
  const key = status ?? "unknown";
  const label = STATUS_LABELS[key] ?? (status ?? "Unknown").replaceAll("_", " ");
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[key] ?? "bg-slate-100 text-slate-600"}`}
    >
      {label}
    </span>
  );
}

export default function ContentStudioPage() {
  const { user } = useAuth();
  const isPlatformAdmin = user?.platform_role === "platform_admin";
  const isSchoolAdmin =
    user?.school_role_key === "school_admin" || user?.platform_role === "platform_admin";

  if (!isPlatformAdmin && !isSchoolAdmin) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-8 text-center">
        <BookOpen className="mx-auto h-10 w-10 text-amber-600" />
        <h1 className="mt-4 text-lg font-semibold text-amber-950">Content access restricted</h1>
        <p className="mt-2 text-sm text-amber-800">
          Only administrators can manage curriculum content.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs font-semibold tracking-widest text-teal-700 uppercase">
          Curriculum
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Content Studio</h1>
        <p className="mt-2 text-sm text-slate-600">
          {isPlatformAdmin
            ? "Upload curriculum materials, review new quests, and publish content for schools."
            : "Choose which quests your school uses, assign content to sections, and track class progress."}
        </p>
      </section>

      {isPlatformAdmin ? <PlatformContentStudio /> : <SchoolContentStudio />}
    </div>
  );
}

function PlatformContentStudio() {
  const [tab, setTab] = useState<PlatformTab>("documents");

  return (
    <>
      <TabNav
        tabs={[
          { id: "documents", label: "Documents", icon: FileUp },
          { id: "catalog", label: "Catalog", icon: FolderTree },
          { id: "review", label: "Pending review", icon: CheckCircle2 },
        ]}
        active={tab}
        onChange={(id) => setTab(id as PlatformTab)}
      />
      {tab === "documents" && <DocumentsTab />}
      {tab === "catalog" && <CatalogTab />}
      {tab === "review" && <ReviewTab />}
    </>
  );
}

function SchoolContentStudio() {
  const [tab, setTab] = useState<SchoolTab>("curation");

  return (
    <>
      <TabNav
        tabs={[
          { id: "curation", label: "Quest library", icon: BookOpen },
          { id: "tracks", label: "Section content", icon: FolderTree },
          { id: "progress", label: "Progress", icon: CheckCircle2 },
        ]}
        active={tab}
        onChange={(id) => setTab(id as SchoolTab)}
      />
      {tab === "curation" && <SchoolCurationTab />}
      {tab === "tracks" && <SectionTracksTab />}
      {tab === "progress" && <SectionProgressTab />}
    </>
  );
}

function TabNav({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string; icon: React.ComponentType<{ className?: string }> }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="border-b border-slate-200">
      <nav className="-mb-px flex gap-6 overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`inline-flex shrink-0 items-center gap-2 border-b-2 pb-3 text-sm font-medium transition-colors ${
              active === id
                ? "border-teal-700 text-teal-800"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function DocumentsTab() {
  const queryClient = useQueryClient();
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [docKind, setDocKind] = useState("student_workbook");
  const [grade, setGrade] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: documents = [], isLoading, refetch } = useQuery<CurriculumDocument[]>({
    queryKey: ["/api/content/documents"],
    queryFn: async () => {
      const res = await fetch("/api/content/documents", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load documents");
      return res.json();
    },
  });

  const { data: subjects = [] } = useQuery<SubjectRow[]>({
    queryKey: ["/api/content/subjects"],
    queryFn: async () => {
      const res = await fetch("/api/content/subjects", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load subjects");
      return res.json();
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file || !title.trim()) throw new Error("Title and file are required");
      const fd = new FormData();
      fd.append("title", title.trim());
      fd.append("doc_kind", docKind);
      fd.append("file", file);
      if (grade) fd.append("grade", grade);
      const subjectId = (document.getElementById("upload-subject") as HTMLSelectElement)?.value;
      if (subjectId) fd.append("subject_id", subjectId);

      const res = await fetch("/api/content/documents", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Upload failed");
      return data;
    },
    onSuccess: () => {
      setFile(null);
      setTitle("");
      setGrade("");
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["/api/content/documents"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/content/documents/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/content/documents"] }),
  });

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) {
      setFile(dropped);
      if (!title) setTitle(dropped.name.replace(/\.[^.]+$/, ""));
    }
  }, [title]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    uploadMutation.mutate();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Upload curriculum document</h2>
        <p className="mt-1 text-sm text-slate-500">
          Add a workbook or teacher guide. New quests will appear for review once processing is complete.
        </p>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`mt-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 transition-colors ${
            dragOver ? "border-teal-400 bg-teal-50/50" : "border-slate-200 bg-slate-50/50"
          }`}
        >
          <Upload className="h-8 w-8 text-slate-400" />
          <p className="mt-3 text-sm font-medium text-slate-700">
            {file ? file.name : "Drag & drop a PDF or DOCX"}
          </p>
          <label className="mt-3 cursor-pointer rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">
            Browse files
            <input
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              onChange={(e) => {
                const picked = e.target.files?.[0];
                if (picked) {
                  setFile(picked);
                  if (!title) setTitle(picked.name.replace(/\.[^.]+$/, ""));
                }
              }}
            />
          </label>
        </div>

        <div className="mt-4 space-y-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Document title"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              id="upload-subject"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500"
            >
              <option value="">Subject (optional)</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              value={docKind}
              onChange={(e) => setDocKind(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500"
            >
              {CURRICULUM_DOC_KINDS.map((k) => (
                <option key={k} value={k}>
                  {DOC_KIND_LABELS[k] ?? k}
                </option>
              ))}
            </select>
          </div>
          <input
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            placeholder="Grade (optional, e.g. 6)"
            type="number"
            min={1}
            max={12}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500"
          />
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={uploadMutation.isPending || !file || !title.trim()}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {uploadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
          Upload document
        </button>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Uploaded documents</h2>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-teal-700" />
          </div>
        ) : documents.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">No documents uploaded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                <tr>
                  <th className="px-5 py-3">Title</th>
                  <th className="px-5 py-3">Kind</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-900">{doc.title}</p>
                      <p className="text-xs text-slate-500">
                        {doc.subject_name ?? "Unassigned"}
                        {doc.grade ? ` · Grade ${doc.grade}` : ""}
                      </p>
                      {doc.processing_error && (
                        <p className="mt-1 text-xs text-red-600">{doc.processing_error}</p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {DOC_KIND_LABELS[doc.doc_kind] ?? doc.doc_kind}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={doc.processing_status} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex gap-2">
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-medium text-teal-700 hover:underline"
                        >
                          View
                        </a>
                        <button
                          type="button"
                          onClick={() => deleteMutation.mutate(doc.id)}
                          className="text-slate-400 hover:text-red-600"
                          aria-label="Delete document"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function CatalogTab() {
  const queryClient = useQueryClient();
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<number | null>(null);
  const [trackLabel, setTrackLabel] = useState("");
  const [trackType, setTrackType] = useState<"grade_subject" | "ct_level">("grade_subject");
  const [trackGrade, setTrackGrade] = useState("6");
  const [trackSubjectId, setTrackSubjectId] = useState("");

  const { data: subjects = [], isLoading: subjectsLoading } = useQuery<SubjectRow[]>({
    queryKey: ["/api/content/subjects"],
    queryFn: async () => {
      const res = await fetch("/api/content/subjects", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load subjects");
      return res.json();
    },
  });

  const chaptersUrl = selectedSubjectId
    ? `/api/content/chapters?subject_id=${selectedSubjectId}`
    : null;

  const { data: chapters = [] } = useQuery<ChapterRow[]>({
    queryKey: [chaptersUrl],
    queryFn: async () => {
      const res = await fetch(chaptersUrl!, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load chapters");
      return res.json();
    },
    enabled: !!chaptersUrl,
  });

  const activitiesUrl = selectedChapterId
    ? `/api/content/activities?chapter_id=${selectedChapterId}`
    : null;

  const { data: activities = [] } = useQuery<ActivityRow[]>({
    queryKey: [activitiesUrl],
    queryFn: async () => {
      const res = await fetch(activitiesUrl!, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load activities");
      return res.json();
    },
    enabled: !!activitiesUrl,
  });

  const { data: tracks = [], refetch: refetchTracks } = useQuery<TrackRow[]>({
    queryKey: ["/api/content/tracks"],
    queryFn: async () => {
      const res = await fetch("/api/content/tracks", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load tracks");
      return res.json();
    },
  });

  const createTrackMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/content/tracks", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          track_type: trackType,
          label: trackLabel.trim(),
          subject_id: trackType === "grade_subject" && trackSubjectId ? parseInt(trackSubjectId, 10) : null,
          grade: trackType === "grade_subject" && trackGrade ? parseInt(trackGrade, 10) : null,
          ct_level: trackType === "ct_level" && trackGrade ? parseInt(trackGrade, 10) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Failed to create track");
      return data;
    },
    onSuccess: () => {
      setTrackLabel("");
      refetchTracks();
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (activityId: number) => {
      const res = await fetch(`/api/content/activities/${activityId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "published" }),
      });
      if (!res.ok) throw new Error("Publish failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [activitiesUrl] });
      queryClient.invalidateQueries({ queryKey: ["/api/content/review-queue"] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <CatalogPanel title="Subjects" loading={subjectsLoading}>
        {subjects.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              setSelectedSubjectId(s.id);
              setSelectedChapterId(null);
            }}
            className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
              selectedSubjectId === s.id ? "bg-teal-50 text-teal-900 ring-1 ring-teal-200" : "hover:bg-slate-50"
            }`}
          >
            <p className="font-medium">{s.name}</p>
            <p className="text-xs text-slate-500">{s.chapter_count} chapters</p>
          </button>
        ))}
      </CatalogPanel>

      <CatalogPanel title="Chapters">
        {!selectedSubjectId ? (
          <p className="text-sm text-slate-500">Select a subject</p>
        ) : (
          chapters.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedChapterId(c.id)}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                selectedChapterId === c.id ? "bg-teal-50 text-teal-900 ring-1 ring-teal-200" : "hover:bg-slate-50"
              }`}
            >
              <p className="font-medium">
                {c.chapter_code} · Grade {c.grade}
              </p>
              <p className="text-xs text-slate-500">{c.title}</p>
            </button>
          ))
        )}
      </CatalogPanel>

      <CatalogPanel title="Activities">
        {!selectedChapterId ? (
          <p className="text-sm text-slate-500">Select a chapter</p>
        ) : activities.length === 0 ? (
          <p className="text-sm text-slate-500">No activities in this chapter yet.</p>
        ) : (
          activities.map((a) => (
            <div
              key={a.id}
              className="flex items-start justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium text-slate-900">{a.title}</p>
                <p className="text-xs text-slate-500">{a.question_count} questions</p>
                <div className="mt-1">
                  <StatusBadge status={a.status} />
                </div>
              </div>
              {a.status !== "published" && (
                <button
                  type="button"
                  onClick={() => publishMutation.mutate(a.id)}
                  className="shrink-0 rounded-lg bg-teal-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-teal-800"
                >
                  Publish
                </button>
              )}
            </div>
          ))
        )}
      </CatalogPanel>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Learning paths</h3>
        <p className="mt-1 text-xs text-slate-500">
          Define which grade and subject (or skill level) each section follows.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_1fr_1fr_auto]">
          <input
            value={trackLabel}
            onChange={(e) => setTrackLabel(e.target.value)}
            placeholder="Path name (e.g. Grade 6 Maths)"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <select
            value={trackType}
            onChange={(e) => setTrackType(e.target.value as "grade_subject" | "ct_level")}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="grade_subject">Grade + subject</option>
            <option value="ct_level">CT level</option>
          </select>
          {trackType === "grade_subject" ? (
            <>
              <select
                value={trackSubjectId}
                onChange={(e) => setTrackSubjectId(e.target.value)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Subject</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <input
                value={trackGrade}
                onChange={(e) => setTrackGrade(e.target.value)}
                placeholder="Grade"
                type="number"
                min={1}
                max={12}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </>
          ) : (
            <input
              value={trackGrade}
              onChange={(e) => setTrackGrade(e.target.value)}
              placeholder="CT level (1-5)"
              type="number"
              min={1}
              max={5}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm md:col-span-2"
            />
          )}
          <button
            type="button"
            disabled={!trackLabel.trim() || createTrackMutation.isPending}
            onClick={() => createTrackMutation.mutate()}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            Add path
          </button>
        </div>
        {tracks.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {tracks.map((t) => (
              <li
                key={t.id}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
              >
                {t.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CatalogPanel({
  title,
  loading,
  children,
}: {
  title: string;
  loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">{title}</h3>
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-teal-700" />
        </div>
      ) : (
        <div className="max-h-[420px] space-y-1 overflow-y-auto">{children}</div>
      )}
    </div>
  );
}

function ReviewTab() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data: items = [], isLoading } = useQuery<ReviewItem[]>({
    queryKey: ["/api/content/review-queue"],
    queryFn: async () => {
      const res = await fetch("/api/content/review-queue", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load review queue");
      return res.json();
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (activityId: number) => {
      const res = await fetch(`/api/content/activities/${activityId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "published" }),
      });
      if (!res.ok) throw new Error("Publish failed");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/content/review-queue"] }),
  });

  if (editingId != null) {
    return (
      <CoachReviewPanel
        activityId={editingId}
        onClose={() => setEditingId(null)}
        onPublished={() => setEditingId(null)}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-teal-700" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-teal-600" />
        <p className="mt-3 font-medium text-slate-900">Nothing pending review</p>
        <p className="mt-1 text-sm text-slate-500">
          New quests from uploaded materials will appear here for approval.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
          <tr>
            <th className="px-5 py-3">Activity</th>
            <th className="px-5 py-3">Chapter</th>
            <th className="px-5 py-3">Status</th>
            <th className="px-5 py-3">Questions</th>
            <th className="px-5 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-slate-50/80">
              <td className="px-5 py-3 font-medium text-slate-900">{item.title}</td>
              <td className="px-5 py-3 text-slate-600">
                {item.subject_name} · {item.chapter_code} (G{item.grade})
              </td>
              <td className="px-5 py-3">
                <StatusBadge status={item.status} />
              </td>
              <td className="px-5 py-3 text-slate-600">{item.question_count}</td>
              <td className="px-5 py-3 text-right">
                <div className="inline-flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingId(item.id)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Review & edit
                  </button>
                  <button
                    type="button"
                    onClick={() => publishMutation.mutate(item.id)}
                    className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
                  >
                    Quick publish
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SchoolCurationTab() {
  const queryClient = useQueryClient();
  const [gradeFilter, setGradeFilter] = useState<string>("");

  const url = gradeFilter ? `/api/school/content?grade=${gradeFilter}` : "/api/school/content";

  const { data, isLoading } = useQuery<{
    activities: SchoolActivity[];
  }>({
    queryKey: [url],
    queryFn: async () => {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load catalog");
      return res.json();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_enabled }: { id: number; is_enabled: boolean }) => {
      const res = await fetch(`/api/school/content/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_enabled }),
      });
      if (!res.ok) throw new Error("Update failed");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [url] }),
  });

  const activities = data?.activities ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-slate-700">Filter by grade</label>
        <select
          value={gradeFilter}
          onChange={(e) => setGradeFilter(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
        >
          <option value="">All grades</option>
          {[3, 4, 5, 6, 7, 8].map((g) => (
            <option key={g} value={g}>
              Grade {g}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-teal-700" />
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="px-5 py-3">Quest</th>
                <th className="px-5 py-3">Chapter</th>
                <th className="px-5 py-3">Enabled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activities.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50/80">
                  <td className="px-5 py-3 font-medium text-slate-900">{a.title}</td>
                  <td className="px-5 py-3 text-slate-600">
                    {a.subject_name} · {a.chapter_code} (G{a.grade})
                  </td>
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      onClick={() => toggleMutation.mutate({ id: a.id, is_enabled: !a.is_enabled })}
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                        a.is_enabled
                          ? "bg-teal-100 text-teal-800"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {a.is_enabled ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5" />
                      )}
                      {a.is_enabled ? "Enabled" : "Disabled"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function SectionTracksTab() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{
    sections: SectionRow[];
    tracks: TrackRow[];
  }>({
    queryKey: ["/api/school/content"],
    queryFn: async () => {
      const res = await fetch("/api/school/content", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load sections");
      return res.json();
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({ sectionId, trackId }: { sectionId: number; trackId: number }) => {
      const res = await fetch(`/api/sections/${sectionId}/track`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ track_id: trackId }),
      });
      if (!res.ok) throw new Error("Failed to assign track");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/school/content"] }),
  });

  const sections = data?.sections ?? [];
  const tracks = data?.tracks ?? [];

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-teal-700" />
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-8 text-center text-sm text-amber-900">
        Learning paths have not been set up yet. Please contact your administrator.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
          <tr>
            <th className="px-5 py-3">Section</th>
            <th className="px-5 py-3">Grade</th>
            <th className="px-5 py-3">Learning path</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sections.map((sec) => (
            <tr key={sec.id}>
              <td className="px-5 py-3 font-medium text-slate-900">{sec.display_name}</td>
              <td className="px-5 py-3 text-slate-600">{sec.grade}</td>
              <td className="px-5 py-3">
                <select
                  value={sec.track_id ?? ""}
                  onChange={(e) =>
                    assignMutation.mutate({
                      sectionId: sec.id,
                      trackId: parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full max-w-xs rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                >
                  <option value="">Select a path…</option>
                  {tracks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionProgressTab() {
  const { data: schoolData } = useQuery<{ sections: SectionRow[] }>({
    queryKey: ["/api/school/content"],
    queryFn: async () => {
      const res = await fetch("/api/school/content", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load sections");
      return res.json();
    },
  });

  const sections = schoolData?.sections ?? [];
  const [sectionId, setSectionId] = useState<number | null>(null);

  const activeSectionId = sectionId ?? sections[0]?.id ?? null;

  const progressUrl = activeSectionId ? `/api/sections/${activeSectionId}/progress` : null;

  const { data: progress, isLoading } = useQuery<{
    summary: { total: number; completed: number };
    activities: {
      id: number;
      title: string;
      chapter_code: string;
      progress_status: string;
      is_enabled: boolean;
    }[];
    track: { label?: string } | null;
  }>({
    queryKey: [progressUrl],
    queryFn: async () => {
      const res = await fetch(progressUrl!, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load progress");
      return res.json();
    },
    enabled: !!progressUrl,
  });

  const queryClient = useQueryClient();
  const updateMutation = useMutation({
    mutationFn: async ({ activityId, status }: { activityId: number; status: string }) => {
      const res = await fetch(`/api/sections/${activeSectionId}/progress`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activity_id: activityId, status }),
      });
      if (!res.ok) throw new Error("Update failed");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [progressUrl] }),
  });

  const pct = useMemo(() => {
    if (!progress?.summary.total) return 0;
    return Math.round((progress.summary.completed / progress.summary.total) * 100);
  }, [progress]);

  if (sections.length === 0) {
    return (
      <p className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500">
        Set up classes and sections in School setup first.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-slate-700">Section</label>
        <select
          value={activeSectionId ?? ""}
          onChange={(e) => setSectionId(parseInt(e.target.value, 10))}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
        >
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.display_name}
            </option>
          ))}
        </select>
      </div>

      {progress?.track == null ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-6 text-sm text-amber-900">
          This section does not have a learning path yet. Assign one in the Section content tab first.
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-900">Overall progress</p>
              <p className="text-xs text-slate-500">
                {progress?.summary.completed ?? 0} of {progress?.summary.total ?? 0} enabled quests completed
              </p>
            </div>
            <p className="text-2xl font-bold text-teal-700">{pct}%</p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-teal-700" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="px-5 py-3">Quest</th>
                <th className="px-5 py-3">Chapter</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(progress?.activities ?? [])
                .filter((a) => a.is_enabled !== false)
                .map((a) => (
                  <tr key={a.id}>
                    <td className="px-5 py-3 font-medium text-slate-900">{a.title}</td>
                    <td className="px-5 py-3 text-slate-600">{a.chapter_code}</td>
                    <td className="px-5 py-3">
                      <select
                        value={a.progress_status}
                        onChange={(e) =>
                          updateMutation.mutate({ activityId: a.id, status: e.target.value })
                        }
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                      >
                        <option value="not_started">Not started</option>
                        <option value="in_progress">In progress</option>
                        <option value="completed">Completed</option>
                        <option value="skipped">Skipped</option>
                      </select>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
