"use client";

import { TeacherShell } from "@/components/teacher-shell";
import { ActiveSessionProvider } from "@/context/active-session-context";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ActiveSessionProvider>
      <TeacherShell>{children}</TeacherShell>
    </ActiveSessionProvider>
  );
}
