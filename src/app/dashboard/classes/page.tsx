"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Loader2, Search, Star, Users } from "lucide-react";
import { useAuth } from "@/context/auth-context";

type TeacherSection = {
  id: number;
  display_name: string;
  section_label?: string;
  grade: number;
  class_id?: number;
  is_primary?: boolean;
};

type TeacherSectionsResponse = {
  sections: TeacherSection[];
  source: "assigned" | "school";
};

export default function ClassesPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState<number | null>(null);

  const { data, isLoading } = useQuery<TeacherSectionsResponse>({
    queryKey: ["/api/teachers/me/sections"],
    queryFn: async () => {
      const res = await fetch("/api/teachers/me/sections", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load sections");
      return res.json();
    },
    enabled: !!user,
  });

  const sections = useMemo(() => data?.sections ?? [], [data]);

  const grades = useMemo(
    () => Array.from(new Set(sections.map((s) => s.grade))).sort((a, b) => a - b),
    [sections],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sections.filter((s) => {
      if (gradeFilter != null && s.grade !== gradeFilter) return false;
      if (!q) return true;
      return s.display_name.toLowerCase().includes(q) || `grade ${s.grade}`.includes(q);
    });
  }, [sections, search, gradeFilter]);

  const groups = useMemo(() => {
    const map = new Map<number, TeacherSection[]>();
    for (const s of visible) {
      const arr = map.get(s.grade) ?? [];
      arr.push(s);
      map.set(s.grade, arr);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([grade, secs]) => ({
        grade,
        sections: secs.sort((a, b) => a.display_name.localeCompare(b.display_name)),
      }));
  }, [visible]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold tracking-widest text-teal-700 uppercase">Classes</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Your class sections</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Open a section to see its roster and each student&apos;s progress across quests, subjects,
          and CBSE mandates.
          {data?.source === "school" && (
            <span className="text-slate-400"> Showing all school sections (no assignments yet).</span>
          )}
        </p>
      </section>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-teal-700" />
        </div>
      ) : sections.length === 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 px-5 py-8 text-center text-sm text-amber-900">
          No sections yet.{" "}
          <Link href="/dashboard/school" className="font-semibold text-teal-800 underline-offset-2 hover:underline">
            Set up classes and sections
          </Link>{" "}
          in the School page first.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search sections…"
                className="w-56 rounded-lg border border-slate-200 py-2 pr-3 pl-9 text-sm text-slate-800 placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
            </div>
            <select
              value={gradeFilter ?? ""}
              onChange={(e) => setGradeFilter(e.target.value ? parseInt(e.target.value, 10) : null)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              aria-label="Filter by class"
            >
              <option value="">All classes</option>
              {grades.map((g) => (
                <option key={g} value={g}>
                  Grade {g}
                </option>
              ))}
            </select>
            <span className="text-xs text-slate-400">
              {visible.length} section{visible.length === 1 ? "" : "s"}
            </span>
          </div>

          {groups.length === 0 ? (
            <p className="text-sm text-slate-500">No sections match your filters.</p>
          ) : (
            <div className="space-y-6">
              {groups.map((group) => (
                <div key={group.grade}>
                  <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    Grade {group.grade}
                  </p>
                  <div className="space-y-2">
                    {group.sections.map((s) => (
                      <Link
                        key={s.id}
                        href={`/dashboard/classes/${s.id}`}
                        className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm transition-all hover:border-teal-200 hover:shadow-md"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 ring-1 ring-teal-100">
                          <Users className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h2 className="truncate text-base font-semibold text-slate-900">
                              {s.display_name}
                            </h2>
                            {s.is_primary && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                                <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                                Primary
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-500">Grade {s.grade}</p>
                        </div>
                        <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-teal-700">
                          View roster
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
