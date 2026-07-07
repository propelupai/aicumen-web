"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Plus, Trash2, Users, X } from "lucide-react";

type AcademicYear = {
  id: number;
  label: string;
  is_current: boolean;
};

type ClassRow = {
  id: number;
  grade: number;
  name: string;
  section_count: number;
};

type SectionRow = {
  id: number;
  class_id: number;
  section_label: string;
  display_name: string;
};

type SectionStudent = {
  user_id: string;
  display_name: string | null;
  email: string;
  username: string | null;
  active_section_id: number | null;
  active_section_name: string | null;
  assigned_to_this_section: boolean;
};

type SectionStudentsPayload = {
  section: { section_id: number; display_name: string; class_name: string };
  students: SectionStudent[];
};

export default function SchoolSetupPage() {
  const queryClient = useQueryClient();
  const [yearLabel, setYearLabel] = useState("2025-26");
  const [classModalOpen, setClassModalOpen] = useState(false);
  const [sectionModalClass, setSectionModalClass] = useState<ClassRow | null>(null);
  const [rosterModalSectionId, setRosterModalSectionId] = useState<number | null>(null);

  const { data: years = [], isLoading: yearsLoading } = useQuery<AcademicYear[]>({
    queryKey: ["/api/academic-years"],
    queryFn: async () => {
      const res = await fetch("/api/academic-years", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load years");
      return res.json();
    },
  });

  const currentYear = useMemo(
    () => years.find((y) => y.is_current) ?? years[0] ?? null,
    [years],
  );

  const { data: classes = [], isLoading: classesLoading } = useQuery<ClassRow[]>({
    queryKey: ["/api/classes", currentYear?.id],
    queryFn: async () => {
      const res = await fetch(`/api/classes?academic_year_id=${currentYear!.id}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load classes");
      return res.json();
    },
    enabled: !!currentYear?.id,
  });

  const createYear = useMutation({
    mutationFn: async (label: string) => {
      const res = await fetch("/api/academic-years", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ label, is_current: true }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? "Failed to create year");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/academic-years"] });
      queryClient.invalidateQueries({ queryKey: ["/api/school/overview"] });
    },
  });

  const createClass = useMutation({
    mutationFn: async ({ grade, academicYearId }: { grade: number; academicYearId: number }) => {
      const res = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ academic_year_id: academicYearId, grade }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? "Failed to create class");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/classes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/school/overview"] });
    },
  });

  const createSection = useMutation({
    mutationFn: async ({ classId, sectionLabel }: { classId: number; sectionLabel: string }) => {
      const res = await fetch("/api/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ class_id: classId, section_label: sectionLabel }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? "Failed to create section");
      }
      return res.json();
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sections", vars.classId] });
      queryClient.invalidateQueries({ queryKey: ["/api/classes"] });
    },
  });

  const deleteSection = useMutation({
    mutationFn: async ({ sectionId, classId }: { sectionId: number; classId: number }) => {
      const res = await fetch(`/api/sections/${sectionId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to remove section");
      return { classId, sectionId };
    },
    onSuccess: ({ classId, sectionId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sections", classId] });
      queryClient.invalidateQueries({ queryKey: ["/api/classes"] });
      if (rosterModalSectionId === sectionId) setRosterModalSectionId(null);
    },
  });

  function handleCreateYear(e: FormEvent) {
    e.preventDefault();
    createYear.mutate(yearLabel.trim());
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold tracking-widest text-teal-700 uppercase">School setup</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
          Year, classes, sections, students
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Create class structure first, then open a section and assign students from your school pool.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Academic year</h2>
        {yearsLoading ? (
          <Loader2 className="mt-4 h-5 w-5 animate-spin text-teal-700" />
        ) : currentYear ? (
          <p className="mt-2 text-sm text-slate-600">
            Current: <span className="font-medium text-slate-900">{currentYear.label}</span>
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-500">No academic year yet.</p>
        )}
        <form onSubmit={handleCreateYear} className="mt-4 flex gap-2">
          <input
            type="text"
            value={yearLabel}
            onChange={(e) => setYearLabel(e.target.value)}
            placeholder="2025-26"
            className="rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
          />
          <button
            type="submit"
            disabled={createYear.isPending || !yearLabel.trim()}
            className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {createYear.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Save
          </button>
        </form>
      </section>

      {currentYear && (
        <section className="rounded-2xl border border-slate-200 bg-white p-0 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Class and section setup</h2>
              <p className="text-sm text-slate-500">{currentYear.label}</p>
            </div>
            <button
              type="button"
              onClick={() => setClassModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
            >
              <Plus className="h-4 w-4" />
              Add class
            </button>
          </div>

          {classesLoading ? (
            <div className="p-6">
              <Loader2 className="h-5 w-5 animate-spin text-teal-700" />
            </div>
          ) : classes.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No classes yet.</p>
          ) : (
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-6 py-3">Class</th>
                  <th className="px-6 py-3">Sections</th>
                  <th className="px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {classes.map((cls) => (
                  <ClassTableRow
                    key={cls.id}
                    classRow={cls}
                    onAddSection={() => setSectionModalClass(cls)}
                    onOpenRoster={(sectionId) => setRosterModalSectionId(sectionId)}
                    onDeleteSection={(sectionId) =>
                      deleteSection.mutate({ sectionId, classId: cls.id })
                    }
                  />
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      <ClassModal
        open={classModalOpen}
        onClose={() => setClassModalOpen(false)}
        onSubmit={(grade) => {
          if (!currentYear) return;
          createClass.mutate(
            { grade, academicYearId: currentYear.id },
            { onSuccess: () => setClassModalOpen(false) },
          );
        }}
        isSaving={createClass.isPending}
      />

      <SectionModal
        open={!!sectionModalClass}
        classRow={sectionModalClass}
        onClose={() => setSectionModalClass(null)}
        onSubmit={(label) => {
          if (!sectionModalClass) return;
          createSection.mutate(
            { classId: sectionModalClass.id, sectionLabel: label },
            { onSuccess: () => setSectionModalClass(null) },
          );
        }}
        isSaving={createSection.isPending}
      />

      <RosterModal
        open={!!rosterModalSectionId}
        sectionId={rosterModalSectionId}
        onClose={() => setRosterModalSectionId(null)}
      />
    </div>
  );
}

function ClassTableRow({
  classRow,
  onAddSection,
  onOpenRoster,
  onDeleteSection,
}: {
  classRow: ClassRow;
  onAddSection: () => void;
  onOpenRoster: (sectionId: number) => void;
  onDeleteSection: (sectionId: number) => void;
}) {
  const { data: sections = [], isLoading } = useQuery<SectionRow[]>({
    queryKey: ["/api/sections", classRow.id],
    queryFn: async () => {
      const res = await fetch(`/api/sections?class_id=${classRow.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load sections");
      return res.json();
    },
  });

  return (
    <tr>
      <td className="px-6 py-4">
        <p className="font-medium text-slate-900">{classRow.name}</p>
        <p className="text-xs text-slate-500">Grade {classRow.grade}</p>
      </td>
      <td className="px-6 py-4">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-teal-700" />
        ) : sections.length === 0 ? (
          <span className="text-sm text-slate-500">No sections</span>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sections.map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
              >
                {s.display_name}
              </span>
            ))}
          </div>
        )}
      </td>
      <td className="px-6 py-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onAddSection}
            className="rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Add section
          </button>
          {sections.map((s) => (
            <div key={s.id} className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={() => onOpenRoster(s.id)}
                className="rounded-md border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-xs font-medium text-teal-800 hover:bg-teal-100"
              >
                {s.display_name} roster
              </button>
              <button
                type="button"
                onClick={() => onDeleteSection(s.id)}
                className="rounded-md p-1 text-slate-400 hover:text-red-600"
                aria-label={`Remove ${s.display_name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </td>
    </tr>
  );
}

function RosterModal({
  open,
  sectionId,
  onClose,
}: {
  open: boolean;
  sectionId: number | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const sectionStudents = useQuery<SectionStudentsPayload>({
    queryKey: ["/api/sections/students", sectionId],
    queryFn: async () => {
      const res = await fetch(`/api/sections/${sectionId}/students`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load students");
      return res.json();
    },
    enabled: !!sectionId,
  });

  useEffect(() => {
    if (!sectionStudents.data) return;
    const ids = sectionStudents.data.students
      .filter((s) => s.assigned_to_this_section)
      .map((s) => s.user_id);
    setSelected(new Set(ids));
  }, [sectionStudents.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/sections/${sectionId}/students`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ student_user_ids: Array.from(selected) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? "Failed to save student assignments");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sections/students", sectionId] });
    },
  });

  if (!open || !sectionId) return null;

  const payload = sectionStudents.data;
  const students = payload?.students ?? [];
  const assigned = students.filter((s) => selected.has(s.user_id));

  return (
    <Modal onClose={onClose} title="Manage section roster">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">
            {payload?.section.display_name ?? "Loading..."}
          </h2>
          <p className="text-sm text-slate-500">{payload?.section.class_name ?? ""}</p>
        </div>
      </div>

      {sectionStudents.isLoading ? (
        <Loader2 className="mt-6 h-5 w-5 animate-spin text-teal-700" />
      ) : students.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">No students found in this school yet.</p>
      ) : (
        <>
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {assigned.length} assigned in this section
          </div>
          <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {students.map((s) => {
              const checked = selected.has(s.user_id);
              const inAnother = s.active_section_id && s.active_section_id !== sectionId;
              return (
                <label
                  key={s.user_id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 ${
                    checked ? "border-teal-300 bg-teal-50" : "border-slate-200 bg-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const next = new Set(selected);
                      if (e.target.checked) next.add(s.user_id);
                      else next.delete(s.user_id);
                      setSelected(next);
                    }}
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {s.display_name?.trim() || s.email}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {s.username ? `@${s.username} · ` : ""}
                      {s.email}
                    </p>
                    {inAnother && (
                      <p className="mt-1 text-xs text-amber-700">
                        Currently in {s.active_section_name}. Saving will transfer this student.
                      </p>
                    )}
                  </div>
                  {checked && <Check className="mt-0.5 h-4 w-4 text-teal-700" />}
                </label>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Users className="h-4 w-4" />
            )}
            Save section roster
          </button>
        </>
      )}
    </Modal>
  );
}

function ClassModal({
  open,
  onClose,
  onSubmit,
  isSaving,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (grade: number) => void;
  isSaving: boolean;
}) {
  const [grade, setGrade] = useState("6");
  useEffect(() => {
    if (open) setGrade("6");
  }, [open]);
  if (!open) return null;
  return (
    <Modal onClose={onClose} title="Add class">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(parseInt(grade, 10));
        }}
        className="space-y-4"
      >
        <label className="block text-sm font-medium text-slate-700">
          Grade
          <select
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500"
          >
            {[3, 4, 5, 6, 7, 8].map((g) => (
              <option key={g} value={g}>
                Class {g}
              </option>
            ))}
          </select>
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Add class"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function SectionModal({
  open,
  classRow,
  onClose,
  onSubmit,
  isSaving,
}: {
  open: boolean;
  classRow: ClassRow | null;
  onClose: () => void;
  onSubmit: (label: string) => void;
  isSaving: boolean;
}) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    if (open) setLabel("");
  }, [open]);
  if (!open || !classRow) return null;
  return (
    <Modal onClose={onClose} title={`Add section to ${classRow.name}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(label.trim().toUpperCase());
        }}
        className="space-y-4"
      >
        <label className="block text-sm font-medium text-slate-700">
          Section label
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="A"
            maxLength={4}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm uppercase outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
          />
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving || !label.trim()}
            className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Add section"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-slate-100">
            <X className="h-4 w-4 text-slate-600" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
