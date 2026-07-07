"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { QuestCard } from "@/components/quest-card";
import { firstName, getTimeGreeting } from "@/lib/quest-preview";
import type { ActivityListItem } from "@/lib/activities";
import { Building2, Loader2 } from "lucide-react";

type Overview = {
  school_name: string | null;
  academic_year: { id: number; label: string } | null;
  class_count: number;
  section_count: number;
};

type ActivitiesResponse = {
  items: ActivityListItem[];
  total: number;
  chapter: { code: string; title: string; grade: number } | null;
};

export default function DashboardHome() {
  const { user } = useAuth();
  const displayName = user?.display_name || user?.firebaseUser.email?.split("@")[0] || "there";
  const greeting = getTimeGreeting();
  const name = firstName(displayName);

  const { data: overview, isLoading: overviewLoading } = useQuery<Overview>({
    queryKey: ["/api/school/overview"],
    queryFn: async () => {
      const res = await fetch("/api/school/overview", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load overview");
      return res.json();
    },
    enabled: !!user,
  });

  const {
    data: activitiesData,
    isLoading: activitiesLoading,
    isError: activitiesError,
  } = useQuery<ActivitiesResponse>({
    queryKey: ["/api/activities"],
    queryFn: async () => {
      const res = await fetch("/api/activities", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load activities");
      return res.json();
    },
    enabled: !!user,
  });

  const activities = activitiesData?.items ?? [];
  const chapter = activitiesData?.chapter;
  const ready = !!overview?.academic_year && (overview?.section_count ?? 0) > 0;

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          {greeting}, {name}!
        </h1>
      </section>

      {!overviewLoading && !ready && (
        <div className="rounded-xl border border-amber-200/70 bg-amber-50/40 px-5 py-4 text-sm text-amber-950">
          Complete{" "}
          <Link
            href="/dashboard/school"
            className="font-semibold text-teal-800 underline-offset-2 hover:underline"
          >
            school setup
          </Link>{" "}
          (academic year + sections) before running live sessions with your class.
        </div>
      )}

      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold tracking-widest text-slate-500 uppercase">
              {chapter ? chapter.title : "Published quests"}
            </p>
            {!activitiesLoading && activities.length > 0 && (
              <p className="mt-1 text-sm text-slate-500">
                {activities.length} quest{activities.length === 1 ? "" : "s"}
                {chapter ? ` · Grade ${chapter.grade}` : ""}
              </p>
            )}
          </div>
          <Link
            href="/dashboard/school"
            className="inline-flex items-center gap-2 rounded-xl border border-teal-200/80 bg-teal-50/50 px-4 py-2.5 text-sm font-semibold text-teal-900 transition-colors hover:bg-teal-50"
          >
            <Building2 className="h-4 w-4" />
            School setup
          </Link>
        </div>

        {activitiesLoading ? (
          <div className="mt-8 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-teal-700" />
          </div>
        ) : activitiesError ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            Could not load quests. Ensure content migrations have been run in Cloud SQL.
          </p>
        ) : activities.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No published quests in the catalog yet.</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {activities.map((activity) => (
              <QuestCard key={activity.id} activity={activity} disabled />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
