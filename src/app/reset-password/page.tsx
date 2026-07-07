"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { clientAuth } from "@/lib/firebaseClient";
import { Lock, CheckCircle2, AlertTriangle, ArrowLeft } from "lucide-react";

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oobCode = searchParams.get("oobCode");

  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState<boolean>(true);
  const [status, setStatus] = useState<{
    type: "success" | "error" | null;
    text: string;
  }>({ type: null, text: "" });

  // Real-time password strength states
  const [strength, setStrength] = useState<{
    score: number; // 0 to 4
    label: string;
    color: string;
  }>({ score: 0, label: "Very Weak", color: "bg-red-400" });

  useEffect(() => {
    // Real-time strength analyzer
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    let label = "Very Weak";
    let color = "bg-red-400";

    if (score >= 4) {
      label = "Strong";
      color = "bg-teal-500";
    } else if (score >= 3) {
      label = "Medium";
      color = "bg-amber-400";
    } else if (score >= 2) {
      label = "Weak";
      color = "bg-orange-400";
    }

    setStrength({ score, label, color });
  }, [password]);

  // 1. Verify the oobCode validity on mount
  useEffect(() => {
    if (!oobCode) {
      setStatus({
        type: "error",
        text: "The reset link is invalid or has expired. Please request a new password reset link.",
      });
      setIsValidating(false);
      return;
    }

    const checkCode = async () => {
      try {
        const userEmail = await verifyPasswordResetCode(clientAuth, oobCode);
        setEmail(userEmail);
      } catch (err) {
        setStatus({
          type: "error",
          text: "The security token is invalid or has already been used. Please request a new password reset link.",
        });
      } finally {
        setIsValidating(false);
      }
    };

    checkCode();
  }, [oobCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oobCode) return;

    setStatus({ type: null, text: "" });

    // Enforce strong password policy (CWE-521)
    if (!PASSWORD_REGEX.test(password)) {
      setStatus({
        type: "error",
        text: "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number.",
      });
      return;
    }

    if (password !== confirmPassword) {
      setStatus({
        type: "error",
        text: "Passwords do not match. Please verify and try again.",
      });
      return;
    }

    setIsLoading(true);

    try {
      // 2. Commit the password reset to Firebase auth
      await confirmPasswordReset(clientAuth, oobCode, password);
      
      setStatus({
        type: "success",
        text: "Your password has been changed successfully! Redirecting you to login page...",
      });

      // Redirect to login page after 3 seconds
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (err: any) {
      console.error("Password reset confirmation failed:", err);
      setStatus({
        type: "error",
        text: "Failed to reset password. The link may have expired. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidating) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <span className="h-8 w-8 border-4 border-blue border-t-transparent rounded-full animate-spin"></span>
        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider animate-pulse">
          Validating Security Token...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Branding */}
      <div className="flex flex-col items-center text-center space-y-3">
        <img
          src="/icons/icon-192x192.png"
          alt="Adani Logo"
          className="h-16 w-16 object-contain rounded-full border border-slate-200 shadow-sm"
        />
        <div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-wide">
            Update Password
          </h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">
            {email ? `Configure password for ${email}` : "Secure Credential Reset"}
          </p>
        </div>
      </div>

      {/* Status indicator block */}
      {status.type && (
        <div
          className={`p-3 rounded-lg border text-xs leading-relaxed flex items-start gap-2 ${
            status.type === "success"
              ? "bg-teal-50 border-teal-200 text-teal-700"
              : "bg-red-50 border-red-200 text-red-655"
          }`}
        >
          {status.type === "success" ? (
            <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          )}
          <span>{status.text}</span>
        </div>
      )}

      {/* Password reset input form (only render if token validation succeeded) */}
      {email && status.type !== "success" && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="pass" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              New Password
            </label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="pass"
                type="password"
                required
                autoComplete="off"
                placeholder="At least 8 characters, A-Z, a-z, 0-9"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-55 border border-slate-200 rounded-lg pl-9 pr-4 py-2.5 text-slate-800 text-xs focus:border-blue focus:outline-none transition-colors"
              />
            </div>
            
            {/* Real-time Password Strength Meter */}
            {password && (
              <div className="pt-1.5 space-y-1">
                <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  <span>Password Strength</span>
                  <span className="text-slate-600 font-black">{strength.label}</span>
                </div>
                <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden flex gap-0.5">
                  <div className={`h-full ${strength.color} transition-all duration-300`} style={{ width: `${Math.min(strength.score * 25, 100)}%` }} />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="confirmPass" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Confirm Password
            </label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="confirmPass"
                type="password"
                required
                autoComplete="off"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-slate-55 border border-slate-200 rounded-lg pl-9 pr-4 py-2.5 text-slate-800 text-xs focus:border-blue focus:outline-none transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue text-white font-bold uppercase text-xs tracking-wider py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-sky-700 transition-colors btn-touch cursor-pointer disabled:bg-blue/50"
          >
            {isLoading ? (
              <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              "Save New Password"
            )}
          </button>
        </form>
      )}

      {/* Back Link */}
      <div className="text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-850 cursor-pointer"
        >
          <ArrowLeft size={13} />
          <span>Return to Login</span>
        </Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center py-6 px-4">
      <div className="card-panel max-w-md w-full p-8 rounded-2xl relative shadow-md">
        <Suspense
          fallback={
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <span className="h-8 w-8 border-4 border-blue border-t-transparent rounded-full animate-spin"></span>
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider animate-pulse">
                Loading password reset...
              </span>
            </div>
          }
        >
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
