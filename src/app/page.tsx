import Link from "next/link";
import {
  BookOpen,
  ClipboardList,
  GraduationCap,
  Layers,
  MessageSquare,
  Footprints,
} from "lucide-react";
import { ScrollReveal } from "@/components/scroll-reveal";

const features = [
  {
    title: "AI Socratic Prompt Coach",
    description:
      "Ordered prompts guide you step by step: what to ask, when to push, and what never to say aloud.",
    icon: MessageSquare,
  },
  {
    title: "Observation Journal",
    description:
      "Log whether each student found the answer, the rule, or can teach it. Your CBSE assessment record.",
    icon: ClipboardList,
  },
  {
    title: "Facilitator Certification",
    description:
      "Train mentors in the Socratic method: never give answers, climb the question ladder, read misconceptions.",
    icon: GraduationCap,
  },
  {
    title: "Multi-modal & unplugged",
    description:
      "Run problems on paper, hop a number line, draw rangoli, or act it out. No devices required in class.",
    icon: Footprints,
  },
  {
    title: "Four subject packs",
    description:
      "Maths, English, Science, and Social Studies, each mapped to CBSE chapters and CT skills.",
    icon: BookOpen,
  },
  {
    title: "Skill-gated progression",
    description:
      "Levels, tiers, and badges that motivate students while keeping pace with demonstrated thinking.",
    icon: Layers,
  },
];

const whyNow = [
  {
    stat: "Mandatory",
    label:
      "CBSE made Computational Thinking a required subject for Classes 3–8 from 2026–27.",
    accent: "border-teal-600",
  },
  {
    stat: "50 hrs/yr",
    label:
      "Schools must deliver CT hours every year, but the timetable is already full.",
    accent: "border-sky-600",
  },
  {
    stat: "5–15 min",
    label:
      "AICUMEN fits inside the lesson you already teach. No extra period required.",
    accent: "border-amber-500",
  },
];

const steps = [
  {
    step: "1",
    title: "Teach your normal chapter",
    description:
      "Fractions, number lines, a Poorvi story, a science experiment: whatever is on today's plan.",
    animation: "fade-right" as const,
    delay: 0,
  },
  {
    step: "2",
    title: "Pick the matching topic",
    description:
      "Open AICUMEN, select your subject and chapter. The right Socratic sparks load instantly.",
    animation: "fade-up" as const,
    delay: 150,
  },
  {
    step: "3",
    title: "Run a Socratic spark",
    description:
      "The prompt coach feeds you the next question at exactly the right moment. Students construct the rule themselves.",
    animation: "fade-left" as const,
    delay: 300,
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-white text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold tracking-tight text-teal-800">
              AICUMEN
            </span>
            <span className="hidden text-xs text-slate-400 sm:inline">
              by PropelUpAI
            </span>
          </div>
          <nav className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-md px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:text-slate-900"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-800"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero: staggered fade-up, one beat at a time */}
        <section className="relative overflow-hidden border-b border-slate-200">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-teal-50/80 via-white to-white" />
          <div className="relative mx-auto max-w-6xl px-6 py-20 sm:py-24">
            <div className="mx-auto max-w-3xl text-center">
              <ScrollReveal animation="fade-in" duration={900} once>
                <p className="text-xs font-semibold tracking-widest text-teal-700 uppercase">
                  CBSE Computational Thinking · Classes 3–8 · 2026–27
                </p>
              </ScrollReveal>

              <ScrollReveal animation="fade-up" delay={120} duration={1000} once>
                <h1 className="mt-5 text-4xl leading-tight font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
                  Give teachers a better question.{" "}
                  <span className="text-teal-700">Never the answer.</span>
                </h1>
              </ScrollReveal>

              <ScrollReveal animation="fade-up" delay={240} duration={1000} once>
                <p className="mt-6 text-lg leading-8 text-slate-600">
                  AICUMEN helps schools meet the CBSE mandate with Socratic
                  computational thinking, layered into the lessons you already
                  teach, in as little as five minutes at the end of class.
                </p>
              </ScrollReveal>

              <ScrollReveal animation="fade-up" delay={380} duration={900} once>
                <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Link
                    href="/signup"
                    className="flex h-11 w-full items-center justify-center rounded-md bg-teal-700 px-8 text-sm font-semibold text-white transition-colors hover:bg-teal-800 sm:w-auto"
                  >
                    Create your account
                  </Link>
                  <Link
                    href="/login"
                    className="flex h-11 w-full items-center justify-center rounded-md border border-slate-300 px-8 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 sm:w-auto"
                  >
                    Sign in
                  </Link>
                </div>
                <p className="mt-5 text-sm text-slate-500">
                  A sign-up code from your school is required to create an
                  account.
                </p>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* Why now: cards rise in sequence */}
        <section className="border-b border-slate-200 bg-slate-50 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-6">
            <ScrollReveal animation="fade-in" duration={800}>
              <h2 className="text-center text-sm font-semibold tracking-widest text-slate-500 uppercase">
                Why schools need this now
              </h2>
            </ScrollReveal>

            <div className="mt-10 grid items-stretch gap-6 sm:grid-cols-3">
              {whyNow.map((item, i) => (
                <ScrollReveal
                  key={item.stat}
                  animation="fade-up"
                  delay={i * 140}
                  duration={950}
                  className="h-full"
                >
                  <div
                    className={`flex h-full flex-col rounded-lg border border-slate-200 border-l-4 ${item.accent} bg-white p-6`}
                  >
                    <p className="text-2xl font-semibold text-slate-900">
                      {item.stat}
                    </p>
                    <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">
                      {item.label}
                    </p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>

        {/* How it works: each step enters from a different direction */}
        <section className="border-b border-slate-200 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-6">
            <ScrollReveal animation="fade-up" duration={900} className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                How it works
              </h2>
              <p className="mt-4 text-slate-600">
                No new timetable slot. No extra training day. Just a spark at
                the end of the lesson you were already teaching.
              </p>
            </ScrollReveal>

            <ol className="relative mt-14 grid gap-10 sm:grid-cols-3 sm:gap-8">
              <div
                aria-hidden
                className="absolute top-5 right-[16.67%] left-[16.67%] hidden h-px bg-slate-200 sm:block"
              />
              {steps.map((item) => (
                <li key={item.step} className="relative list-none">
                  <ScrollReveal
                    animation={item.animation}
                    delay={item.delay}
                    duration={1000}
                    className="flex flex-col"
                  >
                    <div className="relative z-10 mx-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-teal-700 bg-white text-sm font-semibold text-teal-800">
                      {item.step}
                    </div>
                    <h3 className="mt-5 text-center text-base font-semibold text-slate-900">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-center text-sm leading-6 text-slate-600">
                      {item.description}
                    </p>
                  </ScrollReveal>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Prompt Coach: split slide (unchanged motion) */}
        <section className="border-b border-slate-200 bg-slate-50 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <ScrollReveal animation="fade-right" duration={1200}>
                <div>
                  <p className="text-xs font-semibold tracking-widest text-teal-700 uppercase">
                    Live in the classroom
                  </p>
                  <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                    The Socratic Prompt Coach
                  </h2>
                  <p className="mt-4 leading-7 text-slate-600">
                    Your tablet shows the problem and the next question to ask.
                    The class sees only the problem on the board. Students
                    construct the rule themselves. You never hand them the
                    answer.
                  </p>
                  <ul className="mt-6 space-y-2.5 text-sm text-slate-700">
                    <li>Ordered prompts: Notice → Name → Apply → Generalise</li>
                    <li>
                      &ldquo;If stuck&rdquo; hints and &ldquo;don&apos;t
                      say&rdquo; guardrails on every step
                    </li>
                    <li>
                      Log observations as you circulate: Answer, Rule, or Teach
                    </li>
                  </ul>
                </div>
              </ScrollReveal>

              <ScrollReveal animation="fade-left" delay={200} duration={1200}>
                <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                      Live Session · Q3 of 5
                    </span>
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      Pattern Finder
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-700">
                    Messi&apos;s Goal Pattern
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    1, 2, 4, 7, 11. What comes next?
                  </p>

                  <div className="mt-5 rounded-md border-2 border-teal-200 bg-teal-50 p-4">
                    <p className="text-xs font-semibold tracking-wide text-teal-800 uppercase">
                      Ask this now
                    </p>
                    <p className="mt-2 text-base font-medium leading-snug text-slate-900">
                      &ldquo;By how much does it grow each time? Let&apos;s look
                      at the gaps.&rdquo;
                    </p>
                  </div>

                  <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      If student is stuck
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      &ldquo;What&apos;s 2 minus 1? Now 4 minus 2?&rdquo;
                    </p>
                  </div>

                  <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-4">
                    <p className="text-xs font-semibold tracking-wide text-red-700 uppercase">
                      Don&apos;t say
                    </p>
                    <p className="mt-1 text-sm text-red-900">
                      The answer or &ldquo;correct&rdquo;. Make them state the
                      rule.
                    </p>
                  </div>

                  <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full w-3/5 rounded-full bg-teal-600" />
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* Features: rows drift in from alternating sides */}
        <section className="border-b border-slate-200 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-6">
            <ScrollReveal animation="fade-up" duration={900} className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                Built for the classroom, not the screen
              </h2>
              <p className="mt-4 text-slate-600">
                Everything a mentor needs to run rigorous Socratic CT without a
                separate AI period or per-student devices.
              </p>
            </ScrollReveal>

            <div className="mt-12 divide-y divide-slate-200 border-y border-slate-200 sm:grid sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-3">
              {features.map((feature, i) => {
                const Icon = feature.icon;
                const animation =
                  i % 3 === 0
                    ? "fade-right"
                    : i % 3 === 1
                      ? "fade-up"
                      : "fade-left";
                return (
                  <ScrollReveal
                    key={feature.title}
                    animation={animation}
                    delay={(i % 3) * 80}
                    duration={900}
                    className="h-full"
                  >
                    <div className="flex h-full flex-col gap-3 p-6 sm:min-h-[11rem]">
                      <Icon
                        className="h-5 w-5 text-teal-700"
                        strokeWidth={1.75}
                        aria-hidden
                      />
                      <h3 className="text-base font-semibold text-slate-900">
                        {feature.title}
                      </h3>
                      <p className="text-sm leading-6 text-slate-600">
                        {feature.description}
                      </p>
                    </div>
                  </ScrollReveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* Quote: slow scale-in for emphasis */}
        <section className="bg-slate-900 py-16 sm:py-20">
          <ScrollReveal animation="fade-scale" duration={1100} className="mx-auto max-w-3xl px-6 text-center">
            <p className="text-xs font-semibold tracking-widest text-teal-400 uppercase">
              The AICUMEN difference
            </p>
            <blockquote className="mt-5 text-2xl leading-snug font-semibold text-white sm:text-3xl">
              Most edtech hands students answers.{" "}
              <span className="text-teal-400">
                AICUMEN hands teachers better questions.
              </span>
            </blockquote>
            <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-slate-400">
              The screen is a question engine and an observation tool. Never an
              answer key on display.
            </p>
          </ScrollReveal>
        </section>

        {/* CTA: gentle rise */}
        <section className="border-b border-slate-200 py-16 sm:py-20">
          <ScrollReveal animation="fade-up" duration={900} className="mx-auto max-w-2xl px-6 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              Ready to meet the mandate?
            </h2>
            <p className="mt-4 text-slate-600">
              Join your school on AICUMEN and start running Socratic
              computational thinking sparks in your next lesson.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="flex h-11 w-full items-center justify-center rounded-md bg-teal-700 px-8 text-sm font-semibold text-white transition-colors hover:bg-teal-800 sm:w-auto"
              >
                Create your account
              </Link>
              <Link
                href="/login"
                className="flex h-11 w-full items-center justify-center rounded-md border border-slate-300 px-8 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 sm:w-auto"
              >
                Sign in
              </Link>
            </div>
            <p className="mt-5 text-sm text-slate-500">
              A sign-up code from your school is required to create an account.
            </p>
          </ScrollReveal>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-slate-50 py-8 text-center">
        <p className="text-sm text-slate-600">
          © {new Date().getFullYear()} AICUMEN · A product of PropelUpAI, Inc.
        </p>
        <p className="mt-1 text-xs text-slate-400">All rights reserved.</p>
      </footer>
    </div>
  );
}
