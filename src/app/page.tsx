import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-slate-50 text-slate-900">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <span className="text-xl font-bold tracking-tight">
          <span className="bg-gradient-to-r from-indigo-600 to-sky-500 bg-clip-text text-transparent">
            AICUMEN
          </span>
        </span>
        <nav className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
          >
            Get started
          </Link>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-6 py-20 text-center">
        <span className="mb-6 inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500">
          For schools & their innovators
        </span>
        <h1 className="max-w-3xl text-5xl font-bold leading-tight tracking-tight sm:text-6xl">
          Where students turn ideas into{" "}
          <span className="bg-gradient-to-r from-indigo-600 to-sky-500 bg-clip-text text-transparent">
            real ventures
          </span>
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
          AICUMEN gives schools a guided workspace to help students explore, build, and grow their
          innovation projects — from first idea to launch.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="flex h-12 items-center justify-center rounded-full bg-slate-900 px-8 text-base font-medium text-white transition-colors hover:bg-slate-700"
          >
            Create your account
          </Link>
          <Link
            href="/login"
            className="flex h-12 items-center justify-center rounded-full border border-slate-200 bg-white px-8 text-base font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            Sign in
          </Link>
        </div>
        <p className="mt-6 text-sm text-slate-400">
          A sign-up code from your school is required to create an account.
        </p>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-6 py-8 text-center text-sm text-slate-400">
        © {new Date().getFullYear()} AICUMEN. All rights reserved.
      </footer>
    </div>
  );
}
