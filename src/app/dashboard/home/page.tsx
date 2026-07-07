"use client";

import { useAuth } from "@/context/auth-context";

export default function DashboardHome() {
  const { user, signOut } = useAuth();

  const displayName = user?.display_name || user?.firebaseUser.email || "there";

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <span className="text-xl font-bold tracking-tight">
          <span className="bg-gradient-to-r from-indigo-600 to-sky-500 bg-clip-text text-transparent">
            AICUMEN
          </span>
        </span>
        <div className="flex items-center gap-4">
          {user?.school_name && (
            <span className="hidden text-sm text-slate-500 sm:inline">{user.school_name}</span>
          )}
          <button
            type="button"
            onClick={() => signOut()}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Welcome back, {displayName}.</h1>
        <p className="mt-2 text-slate-600">
          This is your AICUMEN home. Your innovation workspace will live here.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {["My Projects", "Explore Ideas", "Resources"].map((title) => (
            <div
              key={title}
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <h2 className="text-lg font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-slate-500">Coming soon.</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
