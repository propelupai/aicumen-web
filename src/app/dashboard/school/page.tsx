"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronRight,
  GraduationCap,
  Loader2,
  Pencil,
  Plus,
  Star,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { UserAvatar } from "@/components/user-avatar";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useToast } from "@/hooks/use-toast";

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

type SectionTeacher = {
  user_id: string;
  display_name: string | null;
  email: string;
  photo_url: string | null;
  role_key: string;
  is_assigned: boolean;
  is_primary: boolean;
};

type SectionTeachersPayload = {
  section: { section_id: number; display_name: string; class_name: string };
  teachers: SectionTeacher[];
};

type SectionDetailTarget = { section: SectionRow; classRow: ClassRow };

export default function SchoolSetupPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  const isAdmin =
    user?.school_role_key === "school_admin" || user?.platform_role === "platform_admin";
  const canWrite = !!user && user.account_type !== "student";
  const canManageTeachers = isAdmin;

  const [yearLabel, setYearLabel] = useState("2025-26");
  const [classModalOpen, setClassModalOpen] = useState(false);
  const [sectionModalClass, setSectionModalClass] = useState<ClassRow | null>(null);
  const [sectionDetail, setSectionDetail] = useState<SectionDetailTarget | null>(null);
  const [classToDelete, setClassToDelete] = useState<ClassRow | null>(null);

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

  const deleteClass = useMutation({
    mutationFn: async (classId: number) => {
      const res = await fetch(`/api/classes/${classId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? "Failed to delete class");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/classes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/school/overview"] });
      setClassToDelete(null);
      toast({ title: "Class deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Could not delete class", description: err.message, variant: "destructive" });
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
          Create the class structure, then open a section to manage its students and assigned
          teachers.
        </p>
        {!canWrite && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            You have read-only access to school setup.
          </p>
        )}
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
        {canWrite && (
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
              {createYear.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Save
            </button>
          </form>
        )}
      </section>

      {currentYear && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Classes &amp; sections</h2>
              <p className="text-sm text-slate-500">{currentYear.label}</p>
            </div>
            {canWrite && (
              <button
                type="button"
                onClick={() => setClassModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
              >
                <Plus className="h-4 w-4" />
                Add class
              </button>
            )}
          </div>

          {classesLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <Loader2 className="h-5 w-5 animate-spin text-teal-700" />
            </div>
          ) : classes.length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
              No classes yet.
            </p>
          ) : (
            <div className="grid gap-4">
              {classes.map((cls) => (
                <ClassCard
                  key={cls.id}
                  classRow={cls}
                  canWrite={canWrite}
                  onAddSection={() => setSectionModalClass(cls)}
                  onManageSection={(section) => setSectionDetail({ section, classRow: cls })}
                  onDeleteClass={() => setClassToDelete(cls)}
                />
              ))}
            </div>
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

      {sectionDetail && (
        <SectionDetailModal
          target={sectionDetail}
          canWrite={canWrite}
          canManageTeachers={canManageTeachers}
          onClose={() => setSectionDetail(null)}
        />
      )}

      <ConfirmDialog
        open={!!classToDelete}
        title={`Delete ${classToDelete?.name ?? "class"}?`}
        description={
          <>
            This permanently removes the class from{" "}
            <span className="font-medium text-slate-800">{currentYear?.label}</span>. This cannot be
            undone.
          </>
        }
        confirmLabel="Delete class"
        isBusy={deleteClass.isPending}
        onConfirm={() => classToDelete && deleteClass.mutate(classToDelete.id)}
        onCancel={() => setClassToDelete(null)}
      />
    </div>
  );
}

function ClassCard({
  classRow,
  canWrite,
  onAddSection,
  onManageSection,
  onDeleteClass,
}: {
  classRow: ClassRow;
  canWrite: boolean;
  onAddSection: () => void;
  onManageSection: (section: SectionRow) => void;
  onDeleteClass: () => void;
}) {
  const { data: sections = [], isLoading } = useQuery<SectionRow[]>({
    queryKey: ["/api/sections", classRow.id],
    queryFn: async () => {
      const res = await fetch(`/api/sections?class_id=${classRow.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load sections");
      return res.json();
    },
  });

  const isEmpty = !isLoading && sections.length === 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-3.5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-700 ring-1 ring-teal-100">
            <GraduationCap className="h-5 w-5" />
          </span>
          <div>
            <p className="font-semibold text-slate-900">{classRow.name}</p>
            <p className="text-xs text-slate-500">
              Grade {classRow.grade} · {sections.length}{" "}
              {sections.length === 1 ? "section" : "sections"}
            </p>
          </div>
        </div>
        {canWrite && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onAddSection}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Add section
            </button>
            <button
              type="button"
              onClick={onDeleteClass}
              disabled={!isEmpty}
              title={
                isEmpty
                  ? "Delete this class"
                  : "Remove all sections before deleting this class"
              }
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-white"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete class
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="p-5">
          <Loader2 className="h-4 w-4 animate-spin text-teal-700" />
        </div>
      ) : sections.length === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-500">
          No sections yet.{" "}
          {canWrite && "Add a section, or delete this class if it isn't needed."}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {sections.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onManageSection(s)}
                className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition-colors hover:bg-slate-50"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                    {s.section_label}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{s.display_name}</p>
                    <p className="text-xs text-slate-500">
                      {canWrite ? "Manage students & teachers" : "View students & teachers"}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type DetailTab = "details" | "students" | "teachers";

function SectionDetailModal({
  target,
  canWrite,
  canManageTeachers,
  onClose,
}: {
  target: SectionDetailTarget;
  canWrite: boolean;
  canManageTeachers: boolean;
  onClose: () => void;
}) {
  const { section, classRow } = target;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<DetailTab>("details");
  const [confirmDeleteSection, setConfirmDeleteSection] = useState(false);

  const deleteSection = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/sections/${section.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? "Failed to remove section");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sections", classRow.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/classes"] });
      setConfirmDeleteSection(false);
      onClose();
      toast({ title: "Section removed" });
    },
    onError: (err: Error) => {
      toast({ title: "Could not remove section", description: err.message, variant: "destructive" });
    },
  });

  const tabs: { key: DetailTab; label: string }[] = [
    { key: "details", label: "Details" },
    { key: "students", label: "Students" },
    { key: "teachers", label: "Teachers" },
  ];

  return (
    <Modal onClose={onClose} title={`${section.display_name} · ${classRow.name}`}>
      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-teal-600 text-teal-800"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="pt-5">
        {tab === "details" && (
          <SectionDetailsTab
            section={section}
            classId={classRow.id}
            canWrite={canWrite}
            onRequestDelete={() => setConfirmDeleteSection(true)}
          />
        )}
        {tab === "students" && (
          <SectionStudentsTab sectionId={section.id} canWrite={canWrite} />
        )}
        {tab === "teachers" && (
          <SectionTeachersTab sectionId={section.id} canManage={canManageTeachers} />
        )}
      </div>

      <ConfirmDialog
        open={confirmDeleteSection}
        title={`Remove ${section.display_name}?`}
        description="Students and teachers assigned to this section will be unlinked. This section will no longer appear in class pickers."
        confirmLabel="Remove section"
        isBusy={deleteSection.isPending}
        onConfirm={() => deleteSection.mutate()}
        onCancel={() => setConfirmDeleteSection(false)}
      />
    </Modal>
  );
}

function SectionDetailsTab({
  section,
  classId,
  canWrite,
  onRequestDelete,
}: {
  section: SectionRow;
  classId: number;
  canWrite: boolean;
  onRequestDelete: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [label, setLabel] = useState(section.section_label);
  const [displayName, setDisplayName] = useState(section.display_name);

  useEffect(() => {
    setLabel(section.section_label);
    setDisplayName(section.display_name);
  }, [section.id, section.section_label, section.display_name]);

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/sections/${section.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          section_label: label.trim().toUpperCase(),
          display_name: displayName.trim(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? "Failed to update section");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sections", classId] });
      queryClient.invalidateQueries({ queryKey: ["/api/classes"] });
      toast({ title: "Section updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Could not update section", description: err.message, variant: "destructive" });
    },
  });

  const dirty =
    label.trim().toUpperCase() !== section.section_label ||
    displayName.trim() !== section.display_name;
  const valid = !!label.trim() && !!displayName.trim();

  if (!canWrite) {
    return (
      <dl className="space-y-4">
        <div>
          <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Label</dt>
          <dd className="mt-1 text-sm text-slate-800">{section.section_label}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Display name
          </dt>
          <dd className="mt-1 text-sm text-slate-800">{section.display_name}</dd>
        </div>
      </dl>
    );
  }

  return (
    <div className="space-y-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid && dirty) save.mutate();
        }}
        className="space-y-4"
      >
        <label className="block text-sm font-medium text-slate-700">
          Section label
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={4}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm uppercase outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Display name
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={60}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
          />
        </label>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={!valid || !dirty || save.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
            Save changes
          </button>
          {dirty && !save.isPending && (
            <button
              type="button"
              onClick={() => {
                setLabel(section.section_label);
                setDisplayName(section.display_name);
              }}
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Reset
            </button>
          )}
        </div>
      </form>

      <div className="rounded-lg border border-red-200 bg-red-50/50 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-red-900">Remove this section</p>
            <p className="text-xs text-red-700">Unlinks students &amp; teachers from the section.</p>
          </div>
          <button
            type="button"
            onClick={onRequestDelete}
            className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionStudentsTab({ sectionId, canWrite }: { sectionId: number; canWrite: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const sectionStudents = useQuery<SectionStudentsPayload>({
    queryKey: ["/api/sections/students", sectionId],
    queryFn: async () => {
      const res = await fetch(`/api/sections/${sectionId}/students`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load students");
      return res.json();
    },
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
      toast({ title: "Section roster saved" });
    },
    onError: (err: Error) => {
      toast({ title: "Could not save roster", description: err.message, variant: "destructive" });
    },
  });

  const students = sectionStudents.data?.students ?? [];
  const assigned = students.filter((s) => selected.has(s.user_id));

  if (sectionStudents.isLoading) {
    return <Loader2 className="h-5 w-5 animate-spin text-teal-700" />;
  }
  if (students.length === 0) {
    return <p className="text-sm text-slate-500">No students found in this school yet.</p>;
  }

  return (
    <>
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
        {assigned.length} assigned in this section
      </div>
      <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto pr-1">
        {students.map((s) => {
          const checked = selected.has(s.user_id);
          const inAnother = s.active_section_id && s.active_section_id !== sectionId;
          return (
            <label
              key={s.user_id}
              className={`flex items-start gap-3 rounded-lg border px-3 py-2 ${
                canWrite ? "cursor-pointer" : "cursor-default"
              } ${checked ? "border-teal-300 bg-teal-50" : "border-slate-200 bg-white"}`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={!canWrite}
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
      {canWrite && (
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
      )}
    </>
  );
}

function SectionTeachersTab({ sectionId, canManage }: { sectionId: number; canManage: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [primary, setPrimary] = useState<string | null>(null);

  const teachersQuery = useQuery<SectionTeachersPayload>({
    queryKey: ["/api/sections/teachers", sectionId],
    queryFn: async () => {
      const res = await fetch(`/api/sections/${sectionId}/teachers`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load teachers");
      return res.json();
    },
  });

  useEffect(() => {
    if (!teachersQuery.data) return;
    const assignedIds = teachersQuery.data.teachers
      .filter((t) => t.is_assigned)
      .map((t) => t.user_id);
    setSelected(new Set(assignedIds));
    const primaryTeacher = teachersQuery.data.teachers.find((t) => t.is_primary);
    setPrimary(primaryTeacher?.user_id ?? null);
  }, [teachersQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/sections/${sectionId}/teachers`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          teacher_user_ids: Array.from(selected),
          primary_user_id: primary && selected.has(primary) ? primary : null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? "Failed to save teacher assignments");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sections/teachers", sectionId] });
      queryClient.invalidateQueries({ queryKey: ["/api/teachers/me/sections"] });
      toast({ title: "Teacher assignments saved" });
    },
    onError: (err: Error) => {
      toast({
        title: "Could not save assignments",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const teachers = teachersQuery.data?.teachers ?? [];

  if (teachersQuery.isLoading) {
    return <Loader2 className="h-5 w-5 animate-spin text-teal-700" />;
  }
  if (teachers.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No staff members yet. Invite teachers from the People page.
      </p>
    );
  }

  function toggle(userId: string, checked: boolean) {
    const next = new Set(selected);
    if (checked) next.add(userId);
    else {
      next.delete(userId);
      if (primary === userId) setPrimary(null);
    }
    setSelected(next);
  }

  return (
    <>
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
        {selected.size} teacher{selected.size === 1 ? "" : "s"} assigned
        {!canManage && " · read-only (school admins can edit)"}
      </div>
      <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto pr-1">
        {teachers.map((t) => {
          const checked = selected.has(t.user_id);
          const isPrimary = primary === t.user_id;
          const name = t.display_name?.trim() || t.email;
          return (
            <div
              key={t.user_id}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                checked ? "border-teal-300 bg-teal-50" : "border-slate-200 bg-white"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={!canManage}
                onChange={(e) => toggle(t.user_id, e.target.checked)}
                className="shrink-0"
              />
              <UserAvatar name={name} photoUrl={t.photo_url} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{name}</p>
                <p className="truncate text-xs text-slate-500">
                  {t.role_key === "school_admin" ? "School admin · " : ""}
                  {t.email}
                </p>
              </div>
              {checked && (
                <button
                  type="button"
                  disabled={!canManage}
                  onClick={() => setPrimary(isPrimary ? null : t.user_id)}
                  title={isPrimary ? "Primary (class) teacher" : "Set as primary teacher"}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed ${
                    isPrimary
                      ? "bg-amber-100 text-amber-800"
                      : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  }`}
                >
                  <Star className={`h-3.5 w-3.5 ${isPrimary ? "fill-amber-500 text-amber-500" : ""}`} />
                  {isPrimary ? "Primary" : "Set primary"}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {canManage && (
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
          Save teacher assignments
        </button>
      )}
    </>
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
