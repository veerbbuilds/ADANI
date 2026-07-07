"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Mail, CheckCircle2, AlertTriangle, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [status, setStatus] = useState<{
    type: "success" | "error" | null;
    text: string;
  }>({ type: null, text: "" });

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ type: null, text: "" });
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus({
          type: "success",
          text: "Branded password reset link sent! Please check your email inbox to proceed.",
        });
        setEmail("");
      } else {
        setStatus({
          type: "error",
          text: data.error || "Failed to send password reset request.",
        });
      }
    } catch (err) {
      console.error("Reset link request failure:", err);
      setStatus({
        type: "error",
        text: "Failed to connect to mail server. Try again later.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-6 px-4">
      <div className="card-panel max-w-md w-full p-8 rounded-2xl relative space-y-6">
        
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center space-y-3">
          <img
            src="/icons/icon-192x192.png"
            alt="Logo"
            className="h-16 w-16 object-contain rounded-full border border-slate-200 shadow-sm"
          />
          <div>
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-wide">
              Reset Password
            </h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">
              Self-Service Recovery
            </p>
          </div>
        </div>

        {/* Status indicator block */}
        {status.type && (
          <div
            className={`p-3 rounded-lg border text-xs leading-relaxed flex items-start gap-2 ${
              status.type === "success"
                ? "bg-teal-50 border-teal-200 text-teal-700"
                : "bg-red-50 border-red-200 text-red-600"
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

        {/* Input Form */}
        <form onSubmit={handleResetSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="email" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Email Address
            </label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="email"
                type="email"
                required
                placeholder="Enter registered email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2.5 text-slate-800 text-xs focus:border-blue focus:outline-none transition-colors"
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
              "Send Reset Link"
            )}
          </button>
        </form>

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
    </div>
  );
}
