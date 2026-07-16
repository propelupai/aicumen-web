"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { GoogleIcon } from "@/components/google-icon";

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signInWithEmail, sendPasswordReset, loading, user } = useAuth();

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard/home");
    }
  }, [loading, user, router]);

  const handleLoginGoogle = async () => {
    setErrorMsg(null);
    try {
      await signIn();
      // auth-context's onAuthStateChanged handles the redirect.
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      setErrorMsg(
        code === "auth/popup-closed-by-user"
          ? "Sign-in canceled. Please try again."
          : "Something went wrong. Please try again.",
      );
    }
  };

  const handleLoginEmail = async () => {
    setErrorMsg(null);
    try {
      await signInWithEmail(email, password);
    } catch (err: unknown) {
      setErrorMsg((err as { message?: string })?.message ?? "Unable to sign in. Please try again.");
    }
  };

  const handleForgot = async () => {
    setErrorMsg(null);
    if (!email) {
      setErrorMsg("Enter your email above, then click 'Forgot password?' again.");
      return;
    }
    try {
      await sendPasswordReset(email);
      setErrorMsg("Password reset email sent. Check your inbox.");
    } catch (err: unknown) {
      setErrorMsg((err as { message?: string })?.message ?? "Could not send reset email.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="absolute left-4 top-4 rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100"
          aria-label="Back to home"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="mb-6 text-center">
          <span className="text-2xl font-bold">
            <span className="bg-gradient-to-r from-indigo-600 to-sky-500 bg-clip-text text-transparent">
              AICUMEN
            </span>
          </span>
          <h1 className="mt-3 text-xl font-semibold text-slate-900">Sign in to your account</h1>
        </div>

        <button
          type="button"
          onClick={handleLoginGoogle}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
        >
          <GoogleIcon className="h-[18px] w-[18px]" />
          <span>{loading ? "Signing in..." : "Continue with Google"}</span>
        </button>

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-slate-200" />
          <span className="text-xs text-slate-400">OR</span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <div className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              onKeyDown={(e) => e.key === "Enter" && handleLoginEmail()}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 pr-10 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <button
            type="button"
            onClick={handleLoginEmail}
            disabled={loading}
            className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
          <button
            type="button"
            onClick={handleForgot}
            disabled={loading}
            className="w-full text-center text-sm text-indigo-600 hover:text-indigo-800"
          >
            Forgot password?
          </button>
        </div>

        {errorMsg && <p className="mt-4 text-center text-sm text-red-600">{errorMsg}</p>}

        <p className="mt-6 text-center text-sm text-slate-500">
          Don&apos;t have an account?{" "}
          <button
            type="button"
            onClick={() => router.push("/signup")}
            className="font-medium text-indigo-600 hover:text-indigo-800"
          >
            Sign up
          </button>
        </p>
      </div>
    </div>
  );
}
