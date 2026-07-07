"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TelemetryEngine } from "@/lib/telemetry";
import { PlusCircle, CheckCircle2, AlertTriangle, User } from "lucide-react";

interface FormData {
  truck_no: string;
  gp_no: string;
  vessel_name: string;
  commodity: string;
  receiver_party: string;
  yard_location: string;
  boe_no: string;
  surveyor_name: string;
}

const initialFormData: FormData = {
  truck_no: "",
  gp_no: "",
  vessel_name: "",
  commodity: "",
  receiver_party: "",
  yard_location: "",
  boe_no: "",
  surveyor_name: "",
};

export default function SurveyorForm() {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);

  // One-time surveyor display name force configuration
  const [showNamePrompt, setShowNamePrompt] = useState<boolean>(false);
  const [tempName, setTempName] = useState<string>("");
  const [isSavingName, setIsSavingName] = useState<boolean>(false);
  const [namePromptError, setNamePromptError] = useState<string | null>(null);
  
  // Status message state
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error" | "info" | null;
    text: string;
  }>({ type: null, text: "" });

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Enforce role check
    const verifyAuth = async () => {
      try {
        const res = await fetch("/api/auth/session");
        if (!res.ok) {
          router.push("/login");
          return;
        }

        const data = await res.json();
        if (!data.authenticated) {
          router.push("/login");
          return;
        }

        let role = data.user.role;
        if (role === "superadmin") {
          const imp = localStorage.getItem("dev_impersonated_role");
          if (imp) role = imp;
        }

        const permRes = await fetch("/api/developer/permissions");
        if (permRes.ok) {
          const permData = await permRes.json();
          const rolePermissions = permData[role];
          if (rolePermissions && !rolePermissions.access_log_entry) {
            if (typeof window !== "undefined" && (window as any).showSystemAlert) {
              (window as any).showSystemAlert(`Access denied. Your active role preview ('${role}') is restricted from accessing Log Entries.`, "error");
            } else {
              alert(`Access denied. Your active role preview ('${role}') is restricted from accessing Log Entries.`);
            }
            router.push("/profile");
            return;
          }
        }

        const nameToUse = data.user.displayName || "";
        const email = data.user.email || "";

        // If display name is unset or is set to email, trigger the one-time name input modal setup
        if (!nameToUse || nameToUse.includes("@")) {
          setShowNamePrompt(true);
          setFormData((prev) => ({ ...prev, surveyor_name: email }));
        } else {
          setFormData((prev) => ({ ...prev, surveyor_name: nameToUse }));
        }

        setIsAuthChecking(false);
      } catch (err) {
        console.error("Auth check failed:", err);
        router.push("/login");
      }
    };

    verifyAuth();
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      TelemetryEngine.syncTelemetryQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let processedValue = value;
    if (name === "truck_no" || name === "gp_no") {
      processedValue = value.toUpperCase().replace(/\s/g, "");
    }
    setFormData((prev) => ({ ...prev, [name]: processedValue }));
  };

  const handleSaveSurveyorName = async (e: React.FormEvent) => {
    e.preventDefault();
    setNamePromptError(null);
    const cleanName = tempName.trim();

    if (cleanName.length < 3) {
      setNamePromptError("Name must be at least 3 characters long.");
      return;
    }

    if (cleanName.includes("@")) {
      setNamePromptError("Please enter your actual name, not an email address.");
      return;
    }

    setIsSavingName(true);

    try {
      const res = await fetch("/api/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: cleanName }),
      });

      if (res.ok) {
        setFormData((prev) => ({ ...prev, surveyor_name: cleanName }));
        setShowNamePrompt(false);
        if (typeof window !== "undefined" && (window as any).showSystemAlert) {
          (window as any).showSystemAlert(`Surveyor name registered successfully: ${cleanName}`, "success");
        }
      } else {
        const data = await res.json();
        setNamePromptError(data.error || "Failed to update surveyor profile name.");
      }
    } catch (err) {
      setNamePromptError("Network failure connecting to profile database.");
    } finally {
      setIsSavingName(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage({ type: null, text: "" });

    const gp_no = formData.gp_no.trim().toUpperCase();
    const truck_no = formData.truck_no.trim().toUpperCase();

    if (!gp_no || !truck_no) {
      setStatusMessage({ type: "error", text: "GP No and Truck No are required." });
      return;
    }

    const gpPattern = /^GP\d{11}$/;
    if (!gpPattern.test(gp_no)) {
      setStatusMessage({
        type: "error",
        text: "Invalid GP Number. Must start with 'GP' followed by 11 digits (e.g. GP26070301214).",
      });
      return;
    }

    setIsLoading(true);

    const coordinates = await TelemetryEngine.getCoordinates();
    const typingTelemetry = TelemetryEngine.compileTelemetry();

    const payload = {
      ...formData,
      gp_no,
      truck_no,
      timestamp: new Date().toISOString(),
      gps: coordinates,
      keystroke_telemetry: typingTelemetry,
    };

    // If offline, queue locally
    if (!navigator.onLine) {
      try {
        const queueRaw = localStorage.getItem("offline_logs_queue");
        const queue = queueRaw ? JSON.parse(queueRaw) : [];
        
        if (queue.some((item: any) => item.gp_no === gp_no)) {
          setStatusMessage({
            type: "error",
            text: `This GP entry (${gp_no}) is already in the queue to be synchronized.`,
          });
          setIsLoading(false);
          return;
        }

        queue.push(payload);
        localStorage.setItem("offline_logs_queue", JSON.stringify(queue));
        window.dispatchEvent(new Event("queue-updated"));

        if (typeof window !== "undefined" && (window as any).showSystemAlert) {
          (window as any).showSystemAlert("📡 Offline Mode: Log entry cached locally on this phone. It will upload automatically when signal returns.", "success");
        } else {
          setStatusMessage({
            type: "success",
            text: "📡 Offline Mode: Log entry cached locally on this phone. It will upload automatically when signal returns.",
          });
        }

        setFormData((prev) => ({
          ...initialFormData,
          surveyor_name: prev.surveyor_name,
        }));
      } catch (err) {
        setStatusMessage({
          type: "error",
          text: "Failed to write to local storage. Device memory is full.",
        });
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Submit online
    try {
      const res = await fetch("/api/log-movement", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      if (res.ok) {
        if (typeof window !== "undefined" && (window as any).showSystemAlert) {
          (window as any).showSystemAlert(`Entry successfully uploaded: ${gp_no}`, "success");
        } else {
          setStatusMessage({
            type: "success",
            text: `Entry successfully uploaded: ${gp_no}`,
          });
        }

        setFormData((prev) => ({
          ...initialFormData,
          surveyor_name: prev.surveyor_name,
        }));
      } else {
        setStatusMessage({
          type: "error",
          text: result.error || "Failed to record log entry.",
        });
      }
    } catch (err) {
      console.warn("API request failed, cache locally:", err);
      const queueRaw = localStorage.getItem("offline_logs_queue");
      const queue = queueRaw ? JSON.parse(queueRaw) : [];
      queue.push(payload);
      localStorage.setItem("offline_logs_queue", JSON.stringify(queue));
      window.dispatchEvent(new Event("queue-updated"));

      if (typeof window !== "undefined" && (window as any).showSystemAlert) {
        (window as any).showSystemAlert("📡 Connection failed mid-transit. Entry cached locally.", "info");
      } else {
        setStatusMessage({
          type: "success",
          text: "📡 Connection failed mid-transit. Entry cached locally.",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isAuthChecking) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 border-4 border-blue border-t-transparent rounded-full animate-spin"></div>
        <span className="text-xs text-slate-455 font-semibold tracking-widest uppercase animate-pulse">
          Verifying security access...
        </span>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      
      {/* Main Entry Form (Title header and card only) */}
      <div className="card-panel p-6 rounded-xl relative">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-3 mb-4">
          <img
            src="/icons/icon-192x192.png"
            alt="Logo"
            className="h-9 w-9 object-contain rounded-full border border-slate-200"
          />
          <div>
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide">
              Yard Placement Form
            </h2>
          </div>
        </div>

        <form onSubmit={handleFormSubmit} className="space-y-4">
          {/* Status block */}
          {statusMessage.type && (
            <div
              className={`p-4 rounded-lg flex items-start gap-3 border text-xs leading-relaxed ${
                statusMessage.type === "success"
                  ? "bg-teal-50 border-teal-200 text-teal-700"
                  : "bg-red-50 border-red-200 text-red-655"
              }`}
            >
              {statusMessage.type === "success" ? (
                <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Locked Surveyor Identity */}
            <div className="col-span-1 sm:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-455 mb-1.5 flex items-center gap-1.5">
                <User size={10} /> Authenticated Surveyor
              </label>
              <input
                id="surveyor_name"
                name="surveyor_name"
                type="text"
                readOnly
                value={formData.surveyor_name}
                className="w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-500 text-xs focus:outline-none cursor-not-allowed font-semibold font-mono"
              />
            </div>

            {/* GP No with telemetry binding */}
            <div>
              <label htmlFor="gp_no" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center justify-between">
                <span>Gate Pass Number (GP No)</span>
                <span className="text-[9px] text-blue normal-case">Format: GP+11 Digits</span>
              </label>
              <input
                id="gp_no"
                name="gp_no"
                type="text"
                required
                placeholder="e.g. GP26070301214"
                value={formData.gp_no}
                onChange={handleInputChange}
                className="w-full bg-slate-55 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-805 text-xs focus:border-blue focus:outline-none transition-colors tracking-widest font-mono font-bold"
              />
            </div>

            {/* Truck No */}
            <div>
              <label htmlFor="truck_no" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Truck Number (Truck No)
              </label>
              <input
                id="truck_no"
                name="truck_no"
                type="text"
                required
                placeholder="e.g. GJ12BZ7739"
                value={formData.truck_no}
                onChange={handleInputChange}
                className="w-full bg-slate-55 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-805 text-xs focus:border-blue focus:outline-none transition-colors tracking-widest font-mono font-bold"
              />
            </div>

            {/* Vessel Name */}
            <div>
              <label htmlFor="vessel_name" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Vessel Name
              </label>
              <input
                id="vessel_name"
                name="vessel_name"
                type="text"
                placeholder="e.g. MV LONG MEI"
                value={formData.vessel_name}
                onChange={handleInputChange}
                className="w-full bg-slate-55 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-805 text-xs focus:border-blue focus:outline-none transition-colors font-semibold"
              />
            </div>

            {/* Commodity */}
            <div>
              <label htmlFor="commodity" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Commodity
              </label>
              <input
                id="commodity"
                name="commodity"
                type="text"
                placeholder="e.g. STEAM COAL"
                value={formData.commodity}
                onChange={handleInputChange}
                className="w-full bg-slate-55 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-805 text-xs focus:border-blue focus:outline-none transition-colors font-semibold"
              />
            </div>

            {/* Receiver Party */}
            <div className="col-span-1 sm:col-span-2">
              <label htmlFor="receiver_party" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Receiver Party
              </label>
              <input
                id="receiver_party"
                name="receiver_party"
                type="text"
                placeholder="e.g. LOTUS RESOURCES INDIA PVT LTD"
                value={formData.receiver_party}
                onChange={handleInputChange}
                className="w-full bg-slate-55 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-805 text-xs focus:border-blue focus:outline-none transition-colors font-semibold"
              />
            </div>

            {/* Yard Location */}
            <div>
              <label htmlFor="yard_location" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Yard Location
              </label>
              <input
                id="yard_location"
                name="yard_location"
                type="text"
                placeholder="e.g. T25-1"
                value={formData.yard_location}
                onChange={handleInputChange}
                className="w-full bg-slate-55 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-805 text-xs focus:border-blue focus:outline-none transition-colors font-mono font-semibold"
              />
            </div>

            {/* BOE No */}
            <div>
              <label htmlFor="boe_no" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Bill of Entry Number (BOE No)
              </label>
              <input
                id="boe_no"
                name="boe_no"
                type="text"
                inputMode="numeric"
                placeholder="e.g. 9694869"
                value={formData.boe_no}
                onChange={handleInputChange}
                className="w-full bg-slate-55 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-805 text-xs focus:border-blue focus:outline-none transition-colors font-mono"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              id="submit-log-btn"
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue text-white font-bold uppercase text-xs tracking-wider py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-sky-700 disabled:bg-blue/50 transition-colors btn-touch cursor-pointer"
            >
              {isLoading ? (
                <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <PlusCircle size={16} />
              )}
              <span>{isLoading ? "Saving Record..." : "Save Truck Entry"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 👤 One-Time Surveyor Name Setup Overlay Modal Dialog */}
      {showNamePrompt && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <div className="h-7 w-7 rounded-full bg-blue/10 text-blue flex items-center justify-center text-xs">
                👤
              </div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                Setup Surveyor Profile Name
              </h3>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
              Please enter your full name. This will be automatically recorded on all movement log entries you submit, instead of your email address.
            </p>

            {namePromptError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-655 text-xs rounded-lg">
                ⚠️ {namePromptError}
              </div>
            )}

            <form onSubmit={handleSaveSurveyorName} className="space-y-3">
              <div className="space-y-1">
                <label htmlFor="modal_name" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Full Name
                </label>
                <input
                  id="modal_name"
                  type="text"
                  required
                  placeholder="e.g. John Doe (Surveyor-1)"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  className="w-full bg-slate-55 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-850 text-xs focus:outline-none focus:border-blue font-semibold"
                />
              </div>

              <button
                type="submit"
                disabled={isSavingName}
                className="w-full bg-blue text-white font-bold uppercase text-xs tracking-wider py-3 rounded-lg hover:bg-sky-700 disabled:bg-blue/50 transition-colors cursor-pointer"
              >
                {isSavingName ? "Saving Profile..." : "Save & Continue"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
