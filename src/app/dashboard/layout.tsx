"use client";

import { TeacherShell } from "@/components/teacher-shell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <TeacherShell>{children}</TeacherShell>;
}
