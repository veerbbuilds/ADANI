"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updatePassword, updateProfile } from "firebase/auth";
import { clientAuth } from "@/lib/firebaseClient";
import { User, Mail, Shield, Smartphone, Key, CheckCircle2, AlertTriangle, LogOut, Copy } from "lucide-react";

interface UserProfile {
  email: string;
  role: string;
  uid: string;
  displayName?: string;
  phoneNumber?: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Form input states
  const [displayName, setDisplayName] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [isProfileUpdating, setIsProfileUpdating] = useState<boolean>(false);

  // Password update states
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [isPassUpdating, setIsPassUpdating] = useState<boolean>(false);

  // Status message
  const [status, setStatus] = useState<{
    type: "success" | "error" | null;
    text: string;
  }>({ type: null, text: "" });

  useEffect(() => {
    const fetchSessionAndProfile = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/auth/session");
        if (!res.ok) {
          router.push("/login");
          return;
        }

        const sessionData = await res.json();
        if (!sessionData.authenticated) {
          router.push("/login");
          return;
        }

        // Get optional Firestore metadata details
        let metadata: any = {};
        try {
          const logsRes = await fetch("/api/get-logs"); // Quick query to get user details or we fetch from user doc
          // Alternatively, call a get profile endpoint. But we can keep it clean:
          // We can write a quick GET in /api/profile/update or fetch directly from local client auth.
          const currentUser = clientAuth.currentUser;
          if (currentUser) {
            metadata.displayName = currentUser.displayName || "";
            metadata.phoneNumber = currentUser.phoneNumber || "";
          }
        } catch (err) {
          // Fallback to basic session details
        }

        const userProfile = {
          ...sessionData.user,
          displayName: metadata.displayName || "",
          phoneNumber: metadata.phoneNumber || "",
        };

        setProfile(userProfile);
        setDisplayName(userProfile.displayName);
        setPhoneNumber(userProfile.phoneNumber);
      } catch (err) {
        console.error("Profile load failure:", err);
        router.push("/login");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSessionAndProfile();
  }, [router]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ type: null, text: "" });
    setIsProfileUpdating(true);

    try {
      const user = clientAuth.currentUser;
      if (!user) throw new Error("No active firebase auth user found.");

      // 1. Update Firebase client profile
      await updateProfile(user, { displayName: displayName });

      // 2. Save details to central database via API
      const res = await fetch("/api/profile/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ displayName, phoneNumber }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus({
          type: "success",
          text: "Profile details updated successfully.",
        });
        if (profile) {
          setProfile({ ...profile, displayName, phoneNumber });
        }
      } else {
        setStatus({
          type: "error",
          text: data.error || "Failed to update profile details.",
        });
      }
    } catch (err: any) {
      console.error("Profile update error:", err);
      setStatus({
        type: "error",
        text: err.message || "Failed to update account profile details.",
      });
    } finally {
      setIsProfileUpdating(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ type: null, text: "" });

    if (newPassword !== confirmPassword) {
      setStatus({ type: "error", text: "Passwords do not match." });
      return;
    }

    const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!PASSWORD_REGEX.test(newPassword)) {
      setStatus({
        type: "error",
        text: "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number.",
      });
      return;
    }

    setIsPassUpdating(true);

    try {
      const user = clientAuth.currentUser;
      if (!user) throw new Error("Please re-authenticate to change your password.");

      // 1. Update client-side Firebase Auth password
      await updatePassword(user, newPassword);

      // 2. Call backend /api/update-user to sync state securely
      await fetch("/api/update-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: profile?.email, password: newPassword }),
      });

      setStatus({
        type: "success",
        text: "Password updated successfully in all systems.",
      });
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      console.error("Password change error:", err);
      if (err.code === "auth/requires-recent-login") {
        setStatus({
          type: "error",
          text: "For security, changing passwords requires a recent login. Please log out, log back in, and try again.",
        });
      } else {
        setStatus({
          type: "error",
          text: err.message || "Failed to update account password.",
        });
      }
    } finally {
      setIsPassUpdating(false);
    }
  };

  const handleCopyUid = () => {
    if (profile?.uid) {
      navigator.clipboard.writeText(profile.uid);
      if (typeof window !== "undefined" && (window as any).showSystemAlert) {
        (window as any).showSystemAlert("UID copied to clipboard!", "success");
      } else {
        alert("UID copied to clipboard!");
      }
    }
  };

  const handleLogout = async () => {
    const performLogout = async () => {
      try {
        const res = await fetch("/api/auth/logout", { method: "POST" });
        if (res.ok) {
          router.push("/login");
          router.refresh();
        }
      } catch (err) {
        console.error("Logout failed:", err);
      }
    };

    if (typeof window !== "undefined" && (window as any).showSystemConfirm) {
      (window as any).showSystemConfirm("Are you sure you want to log out of the system?", performLogout);
    } else {
      if (window.confirm("Are you sure you want to log out?")) {
        performLogout();
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 border-4 border-blue border-t-transparent rounded-full animate-spin"></div>
        <span className="text-xs text-slate-400 font-semibold tracking-widest uppercase animate-pulse">
          Loading profile...
        </span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 uppercase tracking-wide">
            Profile Settings
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage your personal profile and account security settings.
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="bg-red-50 text-red-600 border border-red-200 font-bold uppercase text-xs tracking-wider px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-red-100 transition-colors btn-touch cursor-pointer"
        >
          <LogOut size={14} />
          <span>Log Out</span>
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Side: Account metadata card */}
        <div className="md:col-span-1 space-y-6">
          <div className="card-panel p-5 rounded-xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-blue/10 rounded-full border border-blue/20 flex items-center justify-center text-blue font-bold text-lg uppercase shadow-sm">
                {profile?.email ? profile.email[0] : "U"}
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-800 truncate max-w-[170px]" title={profile?.email}>
                  {profile?.displayName || "Port Staff"}
                </h3>
                <span className="bg-blue/10 text-blue font-bold text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                  {profile?.role}
                </span>
              </div>
            </div>

            <div className="space-y-3 pt-3 border-t border-slate-100 text-xs">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Email Address
                </span>
                <span className="font-mono text-slate-700 font-semibold">{profile?.email}</span>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Staff ID (UID)
                </span>
                <div className="flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-200">
                  <span className="font-mono text-slate-500 text-[10px] truncate max-w-[130px]" title={profile?.uid}>
                    {profile?.uid}
                  </span>
                  <button
                    onClick={handleCopyUid}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    title="Copy UID"
                  >
                    <Copy size={11} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Account updates & password changes */}
        <div className="md:col-span-2 space-y-6">
          {/* Status Message */}
          {status.text && (
            <div
              className={`p-4 rounded-lg border text-xs leading-normal flex items-start gap-2 ${
                status.type === "success"
                  ? "bg-teal-50 border-teal-200 text-teal-700"
                  : "bg-red-50 border-red-200 text-red-600"
              }`}
            >
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span>{status.text}</span>
            </div>
          )}

          {/* Profile Details Edit Card */}
          <div className="card-panel p-5 rounded-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <User size={15} className="text-blue" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Personal Information
              </h3>
            </div>

            <form onSubmit={handleProfileUpdate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label htmlFor="displayName" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Full Display Name
                </label>
                <input
                  id="displayName"
                  type="text"
                  placeholder="e.g. John Doe"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-xs focus:border-blue focus:outline-none transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="phoneNumber" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Contact Phone Number
                </label>
                <div className="relative">
                  <Smartphone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="phoneNumber"
                    type="text"
                    placeholder="e.g. +91 9999999999"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-4 py-2 text-slate-800 text-xs focus:border-blue focus:outline-none transition-colors font-mono"
                  />
                </div>
              </div>

              <div className="sm:col-span-2 pt-2 text-right">
                <button
                  type="submit"
                  disabled={isProfileUpdating}
                  className="bg-blue text-white font-bold uppercase text-[10px] tracking-widest px-6 py-2 rounded hover:bg-sky-700 transition-colors btn-touch cursor-pointer"
                >
                  {isProfileUpdating ? "Saving..." : "Save Details"}
                </button>
              </div>
            </form>
          </div>

          {/* Password update card */}
          <div className="card-panel p-5 rounded-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <Key size={15} className="text-blue" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Security Credentials / Change Password
              </h3>
            </div>

            <form onSubmit={handlePasswordUpdate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label htmlFor="newPass" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  New Password
                </label>
                <input
                  id="newPass"
                  type="password"
                  required
                  placeholder="Min 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-xs focus:border-blue focus:outline-none transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="confirmPass" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Confirm Password
                </label>
                <input
                  id="confirmPass"
                  type="password"
                  required
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-xs focus:border-blue focus:outline-none transition-colors"
                />
              </div>

              <div className="sm:col-span-2 pt-2 text-right">
                <button
                  type="submit"
                  disabled={isPassUpdating}
                  className="bg-blue text-white font-bold uppercase text-[10px] tracking-widest px-6 py-2 rounded hover:bg-sky-700 transition-colors btn-touch cursor-pointer"
                >
                  {isPassUpdating ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
