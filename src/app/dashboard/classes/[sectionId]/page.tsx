"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BarChart3,
  ChevronRight,
  ClipboardList,
  Loader2,
  Search,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { UserAvatar } from "@/components/user-avatar";
import { LevelDistribution } from "@/components/journal-roster-editor";
import { JOURNAL_LEVELS, JOURNAL_LEVEL_META } from "@/lib/journal";

type RosterStudent = {
  user_id: string;
  display_name: string | null;
  email: string;
  username: string | null;
  got_answer: number;
  got_rule: number;
  able_to_teach: number;
  assessed: number;
  last_assessed_at: string | null;
};

type RosterPayload = {
  section: {
    section_id: number;
    display_name: string;
    class_name: string;
    grade: number;
    academic_year_label: string;
  };
  total_activities: number;
  enrolled_count: number;
  students: RosterStudent[];
};

type SortKey = "name" | "most_assessed" | "least_assessed" | "recent";

const SORT_LABELS: Record<SortKey, string> = {
  name: "Name (A–Z)",
  most_assessed: "Most assessed",
  least_assessed: "Least assessed",
  recent: "Recently assessed",
};

function formatDate(value: string | null): string {
  if (!value) return "Not assessed yet";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function SectionRosterPage() {
  const { sectionId } = useParams<{ sectionId: string }>();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("name");

  const { data, isLoading, isError } = useQuery<RosterPayload>({
    queryKey: ["/api/sections/roster", sectionId],
    queryFn: async () => {
      const res = await fetch(`/api/sections/${sectionId}/roster`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load roster");
      return res.json();
    },
    enabled: !!user,
  });

  const students = useMemo(() => data?.students ?? [], [data]);

  const aggregate = useMemo(() => {
    const c = { got_answer: 0, got_rule: 0, able_to_teach: 0 };
    for (const s of students) {
      c.got_answer += s.got_answer;
      c.got_rule += s.got_rule;
      c.able_to_teach += s.able_to_teach;
    }
    return c;
  }, [students]);

  const totalMarks = aggregate.got_answer + aggregate.got_rule + aggregate.able_to_teach;
  const notStartedCount = students.filter((s) => s.assessed === 0).length;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? students.filter((s) => {
          const name = (s.display_name ?? "").toLowerCase();
          return (
            name.includes(q) ||
            s.email.toLowerCase().includes(q) ||
            (s.username ?? "").toLowerCase().includes(q)
          );
        })
      : students.slice();

    const nameOf = (s: RosterStudent) => (s.display_name?.trim() || s.email).toLowerCase();
    filtered.sort((a, b) => {
      switch (sort) {
        case "most_assessed":
          return b.assessed - a.assessed || nameOf(a).localeCompare(nameOf(b));
        case "least_assessed":
          return a.assessed - b.assessed || nameOf(a).localeCompare(nameOf(b));
        case "recent": {
          const at = a.last_assessed_at ? new Date(a.last_assessed_at).getTime() : 0;
          const bt = b.last_assessed_at ? new Date(b.last_assessed_at).getTime() : 0;
          return bt - at || nameOf(a).localeCompare(nameOf(b));
        }
        default:
          return nameOf(a).localeCompare(nameOf(b));
      }
    });
    return filtered;
  }, [students, search, sort]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-teal-700" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Could not load this section&apos;s roster. It may not exist or you may not have access.
        </p>
      </div>
    );
  }

  const { section, total_activities } = data;

  return (
    <div className="space-y-6">
      <BackLink />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-widest text-teal-700 uppercase">
              {section.class_name} · {section.academic_year_label}
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              {section.display_name}
            </h1>
            <p className="mt-1 text-sm text-slate-500">Grade {section.grade}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/dashboard/journal?section_id=${section.section_id}`}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-800"
            >
              <ClipboardList className="h-4 w-4" />
              Mark work
            </Link>
            <Link
              href={`/dashboard/journal?section_id=${section.section_id}&tab=class`}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <BarChart3 className="h-4 w-4" />
              Class insights
            </Link>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Students" value={data.enrolled_count} />
          <StatCard label="Activities run" value={total_activities} />
          <StatCard label="Total marks" value={totalMarks} />
          <StatCard label="Not yet assessed" value={notStartedCount} />
        </div>

        {totalMarks > 0 && (
          <div className="mt-5">
            <p className="mb-1.5 text-xs font-semibold text-slate-600">Class mastery distribution</p>
            <LevelDistribution counts={aggregate} total={totalMarks} />
            <div className="mt-2 flex flex-wrap gap-3">
              {JOURNAL_LEVELS.map((lvl) => (
                <span key={lvl} className="text-[11px] text-slate-500">
                  <span
                    className={`mr-1 inline-block h-2 w-2 rounded-full align-middle ${JOURNAL_LEVEL_META[lvl].barClass}`}
                  />
                  {JOURNAL_LEVEL_META[lvl].label}: {aggregate[lvl]}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">Roster</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search students…"
                className="w-52 rounded-lg border border-slate-200 py-2 pr-3 pl-9 text-sm text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              aria-label="Sort roster"
            >
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                <option key={k} value={k}>
                  {SORT_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {students.length === 0 ? (
          <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-6 text-center text-sm text-amber-900">
            No students enrolled in this section yet.{" "}
            <Link
              href="/dashboard/school"
              className="font-semibold text-teal-800 underline-offset-2 hover:underline"
            >
              Assign students in School setup
            </Link>
            .
          </p>
        ) : visible.length === 0 ? (
          <p className="mt-6 text-sm text-slate-500">No students match “{search}”.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {visible.map((s) => {
              const name = s.display_name?.trim() || s.email;
              return (
                <li key={s.user_id}>
                  <Link
                    href={`/dashboard/classes/${section.section_id}/students/${s.user_id}`}
                    className="flex items-center gap-4 rounded-lg px-2 py-3 transition-colors hover:bg-slate-50"
                  >
                    <UserAvatar name={name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{name}</p>
                      <p className="truncate text-xs text-slate-500">
                        {s.username ? `@${s.username} · ` : ""}
                        {s.assessed > 0
                          ? `${s.assessed} of ${total_activities} activities · last ${formatDate(s.last_assessed_at)}`
                          : "Not assessed yet"}
                      </p>
                    </div>
                    <div className="hidden w-40 shrink-0 sm:block">
                      <LevelDistribution counts={s} total={Math.max(s.assessed, 1)} />
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-0.5 text-[11px] font-medium text-slate-500">{label}</p>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/dashboard/classes"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
    >
      <ArrowLeft className="h-4 w-4" />
      All classes
    </Link>
  );
}
