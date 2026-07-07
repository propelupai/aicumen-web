"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { getCurrentUser } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { GoogleIcon } from "@/components/google-icon";

interface SignupFormData {
  email: string;
  display_name: string;
  signup_code: string;
}

interface FormErrors {
  email?: string;
  display_name?: string;
  signup_code?: string;
  general?: string;
  password?: string;
  confirm_password?: string;
}

export default function SignupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { signUpWithEmail, signInWithEmail, signIn, loading, user } = useAuth();

  const [formData, setFormData] = useState<SignupFormData>({
    email: "",
    display_name: "",
    signup_code: "",
  });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (getCurrentUser() || (!loading && user)) {
      router.replace("/dashboard/home");
    }
  }, [loading, user, router]);

  // Pre-seed the DB user (validates the sign-up code against the school).
  const signupMutation = useMutation({
    mutationFn: async (data: SignupFormData) => {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Signup failed");
      }
      return res.json();
    },
  });

  const handleInputChange = (field: keyof SignupFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validatePasswords = () => {
    const e: FormErrors = {};
    if (!password) e.password = "Password is required";
    if (password && password.length < 6) e.password = "Password must be at least 6 characters";
    if (password !== confirm) e.confirm_password = "Passwords do not match";
    setErrors((prev) => ({ ...prev, ...e }));
    return Object.keys(e).length === 0;
  };

  const createDbUser = async () => {
    setErrors({});
    return signupMutation.mutateAsync(formData);
  };

  const mapError = (error: unknown) => {
    const msg = ((error as { message?: string })?.message || "").toLowerCase();
    const newErrors: FormErrors = {};
    if (msg.includes("signup code") || msg.includes("signup_code")) newErrors.signup_code = (error as Error).message;
    else if (msg.includes("already-in-use"))
      newErrors.email = "Email is already registered. Try Google sign-in, or use 'Forgot password' on Login.";
    else if (msg.includes("email")) newErrors.email = (error as Error).message;
    else newErrors.general = (error as Error).message || "Signup failed";
    setErrors((prev) => ({ ...prev, ...newErrors }));
  };

  // Flow 1: create with email & password
  const handleCreateWithEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePasswords()) return;
    try {
      await createDbUser();
      try {
        await signUpWithEmail(formData.email, password);
      } catch (firebaseErr: unknown) {
        const code = String((firebaseErr as { code?: string })?.code || "");
        if (code === "auth/email-already-in-use") {
          await signInWithEmail(formData.email, password);
        } else {
          throw firebaseErr;
        }
      }
      toast({ title: "Welcome", description: "Account created and signed in." });
      router.push("/dashboard/home");
    } catch (error: unknown) {
      mapError(error);
    }
  };

  // Flow 2: create with Google
  const handleCreateWithGoogle = async () => {
    setErrors({});
    try {
      await createDbUser();
      await signIn();
      router.push("/dashboard/home");
    } catch (error: unknown) {
      mapError(error);
    }
  };

  const inputClass = (hasError?: string) =>
    `w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-100 ${
      hasError ? "border-red-400" : "border-slate-200 focus:border-indigo-400"
    }`;

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
          <h1 className="mt-3 text-xl font-semibold text-slate-900">Create your account</h1>
          <p className="mt-1 text-sm text-slate-500">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="font-medium text-indigo-600 hover:text-indigo-800"
            >
              Sign in
            </button>
          </p>
        </div>

        <form className="space-y-3">
          {errors.general && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{errors.general}</div>
          )}

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={formData.email}
              onChange={(e) => handleInputChange("email", e.target.value)}
              required
              className={inputClass(errors.email)}
            />
            {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}
          </div>

          <div>
            <label htmlFor="display_name" className="mb-1 block text-sm font-medium text-slate-700">
              Display Name
            </label>
            <input
              id="display_name"
              type="text"
              placeholder="Enter your display name"
              value={formData.display_name}
              onChange={(e) => handleInputChange("display_name", e.target.value)}
              required
              className={inputClass(errors.display_name)}
            />
            {errors.display_name && <p className="mt-1 text-sm text-red-500">{errors.display_name}</p>}
          </div>

          <div>
            <label htmlFor="signup_code" className="mb-1 block text-sm font-medium text-slate-700">
              Sign Up Code
            </label>
            <input
              id="signup_code"
              type="text"
              placeholder="Enter the sign-up code from your school"
              value={formData.signup_code}
              onChange={(e) => handleInputChange("signup_code", e.target.value)}
              required
              className={inputClass(errors.signup_code)}
            />
            {errors.signup_code && <p className="mt-1 text-sm text-red-500">{errors.signup_code}</p>}
          </div>

          <button
            type="button"
            onClick={handleCreateWithGoogle}
            disabled={signupMutation.isPending || loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
          >
            <GoogleIcon className="h-[18px] w-[18px]" />
            <span>{signupMutation.isPending ? "Preparing..." : "Sign up with Google"}</span>
          </button>

          <div className="flex items-center gap-3 py-1">
            <span className="h-px flex-1 bg-slate-200" />
            <span className="text-xs text-slate-400">or continue with email</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputClass(errors.password)} pr-10`}
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
            {errors.password && <p className="mt-1 text-sm text-red-500">{errors.password}</p>}
          </div>

          <div>
            <label htmlFor="confirm_password" className="mb-1 block text-sm font-medium text-slate-700">
              Confirm Password
            </label>
            <div className="relative">
              <input
                id="confirm_password"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Re-enter your password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={`${inputClass(errors.confirm_password)} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirm_password && (
              <p className="mt-1 text-sm text-red-500">{errors.confirm_password}</p>
            )}
          </div>

          <button
            type="submit"
            onClick={handleCreateWithEmail}
            disabled={signupMutation.isPending || loading}
            className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-60"
          >
            {signupMutation.isPending ? "Creating account..." : "Sign up with Email"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">
          By creating an account, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
