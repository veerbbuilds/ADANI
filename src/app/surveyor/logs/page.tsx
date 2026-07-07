"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { RefreshCcw, Lock, Edit2, AlertTriangle, CheckCircle2, Search } from "lucide-react";

export default function SurveyorLogsPage() {
  const router = useRouter();
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [myLogs, setMyLogs] = useState<any[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<any[]>([]);
  const [isLogsLoading, setIsLogsLoading] = useState<boolean>(false);
  const [search, setSearch] = useState<string>("");

  // Edit Modal states
  const [editingLog, setEditingLog] = useState<any | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  const fetchMyLogs = async () => {
    setIsLogsLoading(true);
    try {
      const res = await fetch("/api/get-logs");
      if (res.ok) {
        const data = await res.json();
        const logsArray = Array.isArray(data) ? data : [];
        setMyLogs(logsArray);
        setFilteredLogs(logsArray);
      }
    } catch (err) {
      console.error("Failed to load logs:", err);
    } finally {
      setIsLogsLoading(false);
    }
  };

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

        // Restrict this log page to valid roles
        if (role !== "surveyor" && role !== "admin" && role !== "superadmin") {
          if (typeof window !== "undefined" && (window as any).showSystemAlert) {
            (window as any).showSystemAlert(`Access denied. Your active role preview ('${role}') is restricted.`, "error");
          } else {
            alert(`Access denied. Your active role preview ('${role}') is restricted.`);
          }
          router.push("/profile");
          return;
        }

        setIsAuthChecking(false);
        fetchMyLogs();
      } catch (err) {
        console.error("Auth check failed:", err);
        router.push("/login");
      }
    };

    verifyAuth();
  }, [router]);

  // Apply search query filtering in real-time
  useEffect(() => {
    if (!search.trim()) {
      setFilteredLogs(myLogs);
      return;
    }

    const q = search.toLowerCase();
    const result = myLogs.filter(
      (log) =>
        log.gp_no.toLowerCase().includes(q) ||
        log.truck_no.toLowerCase().includes(q) ||
        (log.vessel_name || "").toLowerCase().includes(q) ||
        (log.commodity || "").toLowerCase().includes(q)
    );
    setFilteredLogs(result);
  }, [search, myLogs]);

  // Open edit modal if less than 30 minutes old or temp unlocked
  const handleEditClick = (log: any) => {
    setEditingLog(log);
    setEditFormData({
      gp_no: log.gp_no,
      truck_no: log.truck_no,
      vessel_name: log.vessel_name || "",
      commodity: log.commodity || "",
      receiver_party: log.receiver_party || "",
      yard_location: log.yard_location || "",
      boe_no: log.boe_no || "",
    });
    setEditError(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    setEditError(null);

    try {
      const res = await fetch("/api/update-log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editFormData),
      });

      const data = await res.json();
      if (res.ok) {
        setEditingLog(null);
        if (typeof window !== "undefined" && (window as any).showSystemAlert) {
          (window as any).showSystemAlert("Log entry corrected successfully.", "success");
        }
        fetchMyLogs(); // Reload logs list
      } else {
        setEditError(data.error || "Failed to update log entry.");
      }
    } catch (err) {
      setEditError("Connection error updating log entry.");
    } finally {
      setIsUpdating(false);
    }
  };

  const isEditable = (log: any) => {
    if (!log.timestamp) return false;
    if (log.allow_surveyor_edit === true) return true;
    const docTimeMs = new Date(log.timestamp).getTime();
    const diffMs = Date.now() - docTimeMs;
    return diffMs < 30 * 60 * 1000; // Less than 30 minutes
  };

  if (isAuthChecking) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 border-4 border-blue border-t-transparent rounded-full animate-spin"></div>
        <span className="text-xs text-slate-450 font-semibold tracking-widest uppercase animate-pulse">
          Loading logs database...
        </span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Page header and search options */}
      <div className="card-panel p-5 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-black text-slate-800 uppercase tracking-wide">
            My Submitted Logs
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 leading-normal">
            Logs history sheets submitted under your surveyor account credentials.
          </p>
        </div>

        <div className="flex items-center gap-2 max-w-sm w-full md:w-auto">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search size={14} />
            </span>
            <input
              type="text"
              placeholder="Search GP, Truck or Vessel..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue transition-colors font-medium"
            />
          </div>

          <button
            onClick={fetchMyLogs}
            disabled={isLogsLoading}
            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-slate-700 cursor-pointer flex items-center justify-center shrink-0"
            title="Refresh list"
          >
            <RefreshCcw size={14} className={isLogsLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Submitted Logs List container */}
      <div className="card-panel rounded-xl overflow-hidden p-5 space-y-3">
        {isLogsLoading ? (
          <div className="p-12 text-center text-xs text-slate-400 uppercase tracking-widest animate-pulse">
            Loading yard entries...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs uppercase tracking-wider font-semibold">
            No matching log entries found.
          </div>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {filteredLogs.map((log) => {
              const editable = isEditable(log);
              return (
                <div
                  key={log.gp_no}
                  className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between hover:border-slate-350 transition-all hover:bg-slate-50/80 gap-3 shadow-sm"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-mono font-bold text-slate-800">
                        {log.truck_no}
                      </span>
                      <span className="text-xs font-mono text-blue bg-blue/5 border border-blue/10 px-2 py-0.5 rounded font-bold">
                        {log.gp_no}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-[11px] text-slate-550">
                      <span>Vessel: <span className="font-semibold text-slate-700">{log.vessel_name || "—"}</span></span>
                      <span>Commodity: <span className="font-semibold text-slate-700">{log.commodity || "—"}</span></span>
                      <span>Location: <span className="font-semibold text-slate-700 font-mono">{log.yard_location || "—"}</span></span>
                      <span>BOE No: <span className="font-semibold text-slate-700 font-mono">{log.boe_no || "—"}</span></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:self-center">
                    <span className="text-[10px] text-slate-450 font-mono hidden md:inline shrink-0">
                      {log.timestamp ? new Date(log.timestamp).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : "—"}
                    </span>

                    {editable ? (
                      <button
                        onClick={() => handleEditClick(log)}
                        className="p-2 bg-blue/5 border border-blue/10 text-blue hover:bg-blue hover:text-white rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider"
                      >
                        <Edit2 size={12} />
                        <span>Edit</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-450 uppercase bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 select-none shrink-0" title="Locked after 30 minutes. Contact admin to edit.">
                        <Lock size={12} />
                        <span>Locked</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Surveyor Edit Modal Dialog Overlay */}
      {editingLog && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Edit2 size={14} className="text-blue" /> Edit Yard Placement Record
              </h3>
              <span className="text-[9px] bg-blue/5 border border-blue/10 text-blue font-bold px-2 py-0.5 rounded font-mono">
                {editFormData.gp_no}
              </span>
            </div>

            {editError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-655 text-xs rounded-lg flex items-center gap-2">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">
                    Truck Number
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.truck_no}
                    onChange={(e) => setEditFormData({ ...editFormData, truck_no: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-blue"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">
                    Vessel Name
                  </label>
                  <input
                    type="text"
                    value={editFormData.vessel_name}
                    onChange={(e) => setEditFormData({ ...editFormData, vessel_name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">
                    Commodity
                  </label>
                  <input
                    type="text"
                    value={editFormData.commodity}
                    onChange={(e) => setEditFormData({ ...editFormData, commodity: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">
                    Receiver Party
                  </label>
                  <input
                    type="text"
                    value={editFormData.receiver_party}
                    onChange={(e) => setEditFormData({ ...editFormData, receiver_party: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">
                    Yard Location
                  </label>
                  <input
                    type="text"
                    value={editFormData.yard_location}
                    onChange={(e) => setEditFormData({ ...editFormData, yard_location: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold uppercase text-slate-450 mb-1">
                    BOE Number
                  </label>
                  <input
                    type="text"
                    value={editFormData.boe_no}
                    onChange={(e) => setEditFormData({ ...editFormData, boe_no: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingLog(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-6 py-2 bg-blue text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-sky-700 disabled:bg-blue/50 cursor-pointer"
                >
                  {isUpdating ? "Updating..." : "Update Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
