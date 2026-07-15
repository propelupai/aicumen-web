"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ClipboardList, Loader2 } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { StudentJournalView, type StudentJournal } from "@/components/student-journal-view";

export default function StudentProgressPage() {
  const { sectionId, studentId } = useParams<{ sectionId: string; studentId: string }>();
  const { user } = useAuth();

  const { data, isLoading, isError } = useQuery<StudentJournal>({
    queryKey: ["/api/students/journal", studentId],
    queryFn: async () => {
      const res = await fetch(`/api/students/${studentId}/journal`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load student journal");
      return res.json();
    },
    enabled: !!user && !!studentId,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/dashboard/classes/${sectionId}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to roster
        </Link>
        <Link
          href={`/dashboard/journal?section_id=${sectionId}`}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          <ClipboardList className="h-4 w-4" />
          Mark work
        </Link>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-teal-700" />
        </div>
      ) : isError || !data ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Could not load this student&apos;s progress.
        </p>
      ) : (
        <StudentJournalView data={data} />
      )}
    </div>
  );
}
