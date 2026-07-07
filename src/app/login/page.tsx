"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signInWithEmailAndPassword } from "firebase/auth";
import { clientAuth } from "@/lib/firebaseClient";
import { TelemetryEngine } from "@/lib/telemetry";
import { Lock, Mail, Eye, EyeOff, AlertTriangle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Sync telemetry queue if any offline events remained
    TelemetryEngine.syncTelemetryQueue();

    const checkActiveSession = async () => {
      try {
        const res = await fetch("/api/auth/session");
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            redirectByUserRole(data.user.role);
          }
        }
      } catch (err) {
        // Safe to ignore
      }
    };
    checkActiveSession();
  }, []);

  const redirectByUserRole = (role: string) => {
    if (role === "admin") {
      router.push("/dashboard");
    } else if (role === "superadmin") {
      router.push("/developer");
    } else {
      router.push("/surveyor");
    }
    router.refresh();
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // 1. Authenticate with client SDK
      const userCredential = await signInWithEmailAndPassword(clientAuth, email, password);
      const user = userCredential.user;

      // 2. Fetch JWT ID Token
      const idToken = await user.getIdToken();

      // 3. Exchange for HttpOnly session cookies
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ idToken }),
      });

      const data = await res.json();

      if (res.ok) {
        // Dispatch LOGIN_SUCCESS audit log with GPS and input telemetry
        await TelemetryEngine.dispatchEvent({
          eventType: "LOGIN_SUCCESS",
          email: email,
          metadata: {
            uid: user.uid,
            role: data.user.role,
            keystroke_telemetry: TelemetryEngine.compileTelemetry(),
          },
        });

        redirectByUserRole(data.user.role);
      } else {
        throw new Error(data.error || "Failed to set server cookies.");
      }
    } catch (err: any) {
      // Dispatch LOGIN_FAILURE audit log
      try {
        await TelemetryEngine.dispatchEvent({
          eventType: "LOGIN_FAILURE",
          email: email,
          metadata: {
            reason: err?.message || "Invalid credentials",
            keystroke_telemetry: TelemetryEngine.compileTelemetry(),
          },
        });
      } catch (telemetryErr) {
        // Fallback silently if telemetry dispatch fails
      }

      const errCode = err?.code || "";
      const errMsg = err?.message || "";
      const isCredentialError = 
        errCode === "auth/invalid-credential" ||
        errCode === "auth/user-not-found" ||
        errCode === "auth/wrong-password" ||
        errMsg.includes("auth/invalid-credential") ||
        errMsg.includes("auth/user-not-found") ||
        errMsg.includes("auth/wrong-password");

      if (isCredentialError) {
        setError("Invalid email address or password. Please verify and try again.");
      } else if (errCode === "auth/too-many-requests" || errMsg.includes("auth/too-many-requests")) {
        setError("Account temporarily locked due to too many failed attempts. Try again later.");
      } else {
        setError("Authentication service unavailable. Please check your connection and try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-6 px-4">
      <div className="card-panel max-w-md w-full p-8 rounded-2xl relative space-y-6">
        
        {/* Header branding */}
        <div className="flex flex-col items-center text-center space-y-3">
          <img
            src="/icons/icon-192x192.png"
            alt="Adani Port Logo"
            className="h-16 w-16 object-contain rounded-full border border-slate-200 shadow-sm"
          />
          <div>
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-wide">
              Logistics Logbook
            </h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">
              Secure Staff Login
            </p>
          </div>
        </div>

        {/* Error block */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-650 flex items-start gap-2 leading-relaxed">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form fields with telemetry tracking */}
        <form onSubmit={handleLoginSubmit} className="space-y-4">
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
                placeholder="surveyor@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => TelemetryEngine.startFocus("email")}
                onBlur={() => TelemetryEngine.endFocus("email")}
                onKeyDown={() => TelemetryEngine.recordKeypress("email")}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2.5 text-slate-800 text-xs focus:border-blue focus:outline-none transition-colors font-semibold"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-[10px] font-bold text-blue hover:underline cursor-pointer"
              >
                Forgot Password?
              </Link>
            </div>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => TelemetryEngine.startFocus("password")}
                onBlur={() => TelemetryEngine.endFocus("password")}
                onKeyDown={() => TelemetryEngine.recordKeypress("password")}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-10 py-2.5 text-slate-800 text-xs focus:border-blue focus:outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
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
              "Sign In"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
