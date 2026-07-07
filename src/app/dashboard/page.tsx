"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Download, RefreshCw, Layers, Anchor, Truck, ListFilter, ArrowUpDown, Unlock, Lock, Edit2, Trash2, AlertTriangle } from "lucide-react";

interface LogEntry {
  gp_no: string;
  truck_no: string;
  vessel_name: string;
  commodity: string;
  receiver_party: string;
  yard_location: string;
  boe_no: string;
  surveyor_name: string;
  surveyor_email?: string;
  allow_surveyor_edit?: boolean;
  timestamp: string;
}

type SortField = "gp_no" | "truck_no" | "vessel_name" | "yard_location" | "timestamp";
type SortOrder = "asc" | "desc";

export default function Dashboard() {
  const router = useRouter();
  
  // States
  const [allLogs, setAllLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("");
  const [currentUserRole, setCurrentUserRole] = useState<string>("");
  const [unlockingGp, setUnlockingGp] = useState<string | null>(null);

  // Edit & Delete overlay states
  const [editingLog, setEditingLog] = useState<LogEntry | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Search & Filter options
  const [search, setSearch] = useState<string>("");
  const [selectedVessel, setSelectedVessel] = useState<string>("ALL");
  const [selectedCommodity, setSelectedCommodity] = useState<string>("ALL");
  const [selectedLocation, setSelectedLocation] = useState<string>("ALL");

  // Sorting
  const [sortField, setSortField] = useState<SortField>("timestamp");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Dynamic filter dropdown options
  const [vesselOptions, setVesselOptions] = useState<string[]>([]);
  const [commodityOptions, setCommodityOptions] = useState<string[]>([]);
  const [locationOptions, setLocationOptions] = useState<string[]>([]);

  const fetchLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/get-logs");
      if (!res.ok) {
        throw new Error(`Failed to load logs (HTTP ${res.status})`);
      }
      const data = await res.json();
      const logsArray = Array.isArray(data) ? data : [];
      setAllLogs(logsArray);
      
      // Compile dynamic filter selections
      setVesselOptions(Array.from(new Set(logsArray.map((l) => l.vessel_name).filter(Boolean))));
      setCommodityOptions(Array.from(new Set(logsArray.map((l) => l.commodity).filter(Boolean))));
      setLocationOptions(Array.from(new Set(logsArray.map((l) => l.yard_location).filter(Boolean))));
    } catch (err: any) {
      setError(err.message || "An unknown error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlockForSurveyor = async (gp_no: string) => {
    setUnlockingGp(gp_no);
    try {
      const res = await fetch("/api/update-log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ gp_no, action: "unlock" }),
      });
      if (res.ok) {
        if (typeof window !== "undefined" && (window as any).showSystemAlert) {
          (window as any).showSystemAlert(`Log entry ${gp_no} has been temporarily unlocked. The surveyor can now correct their mistakes.`, "success");
        } else {
          alert(`Log entry ${gp_no} has been temporarily unlocked. The surveyor can now correct their mistakes.`);
        }
        fetchLogs();
      } else {
        const data = await res.json();
        if (typeof window !== "undefined" && (window as any).showSystemAlert) {
          (window as any).showSystemAlert(data.error || "Failed to unlock record.", "error");
        } else {
          alert(data.error || "Failed to unlock record.");
        }
      }
    } catch (err) {
      if (typeof window !== "undefined" && (window as any).showSystemAlert) {
        (window as any).showSystemAlert("Network failure attempting to unlock log entry.", "error");
      } else {
        alert("Network failure attempting to unlock log entry.");
      }
    } finally {
      setUnlockingGp(null);
    }
  };

  const handleEditClick = (log: LogEntry) => {
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editFormData),
      });

      const data = await res.json();
      if (res.ok) {
        setEditingLog(null);
        if (typeof window !== "undefined" && (window as any).showSystemAlert) {
          (window as any).showSystemAlert(`Yard placement log ${editFormData.gp_no} successfully updated.`, "success");
        }
        fetchLogs(); // Reload logs list
      } else {
        setEditError(data.error || "Failed to update database entry.");
      }
    } catch (err) {
      setEditError("Connection error saving database updates.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteLogEntry = async (gp_no: string) => {
    const performDelete = async () => {
      try {
        const res = await fetch(`/api/delete-log?gp_no=${gp_no}`, {
          method: "DELETE",
        });

        if (res.ok) {
          if (typeof window !== "undefined" && (window as any).showSystemAlert) {
            (window as any).showSystemAlert(`Log GP ${gp_no} permanently deleted from database.`, "success");
          }
          fetchLogs(); // Reload list
        } else {
          const data = await res.json();
          if (typeof window !== "undefined" && (window as any).showSystemAlert) {
            (window as any).showSystemAlert(data.error || "Failed to delete log.", "error");
          }
        }
      } catch (err) {
        if (typeof window !== "undefined" && (window as any).showSystemAlert) {
          (window as any).showSystemAlert("Connection error deleting log record.", "error");
        }
      }
    };

    if (typeof window !== "undefined" && (window as any).showSystemConfirm) {
      (window as any).showSystemConfirm(`Are you sure you want to permanently delete movement log entry ${gp_no}?`, performDelete);
    } else {
      if (window.confirm(`Are you sure you want to permanently delete movement log entry ${gp_no}?`)) {
        performDelete();
      }
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

        // Retrieve matrix permissions
        const permRes = await fetch("/api/developer/permissions");
        if (permRes.ok) {
          const permData = await permRes.json();
          const rolePermissions = permData[role];
          
          if (rolePermissions && !rolePermissions.access_dashboard) {
            if (typeof window !== "undefined" && (window as any).showSystemAlert) {
              (window as any).showSystemAlert(`Access denied. Your active role preview ('${role}') is restricted from accessing the Dashboard.`, "error");
            } else {
              alert(`Access denied. Your active role preview ('${role}') is restricted from accessing the Dashboard.`);
            }
            router.push("/profile");
            return;
          }
        }

        setCurrentUserEmail(data.user.email);
        setCurrentUserRole(data.user.role);

        setIsAuthChecking(false);
        fetchLogs();
      } catch (err) {
        console.error("Auth verification failed:", err);
        router.push("/login");
      }
    };

    verifyAuth();
  }, [router]);

  // Apply filters, search queries, and sorting in real-time
  useEffect(() => {
    let result = [...allLogs];

    // Lock down data view client-side if role (or impersonation preview) is surveyor
    const impRole = typeof window !== "undefined" ? localStorage.getItem("dev_impersonated_role") : null;
    const activeRole = impRole || currentUserRole;

    if (activeRole === "surveyor" && currentUserEmail) {
      const emailLower = currentUserEmail.toLowerCase();
      result = result.filter(
        (log) =>
          (log.surveyor_email || "").toLowerCase() === emailLower ||
          (log.surveyor_name || "").toLowerCase().includes(emailLower)
      );
    }

    // Search query matches
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (log) =>
          log.gp_no.toLowerCase().includes(q) ||
          log.truck_no.toLowerCase().includes(q) ||
          (log.vessel_name || "").toLowerCase().includes(q) ||
          (log.commodity || "").toLowerCase().includes(q) ||
          (log.receiver_party || "").toLowerCase().includes(q)
      );
    }

    // Dropdown filters
    if (selectedVessel !== "ALL") {
      result = result.filter((log) => log.vessel_name === selectedVessel);
    }
    if (selectedCommodity !== "ALL") {
      result = result.filter((log) => log.commodity === selectedCommodity);
    }
    if (selectedLocation !== "ALL") {
      result = result.filter((log) => log.yard_location === selectedLocation);
    }

    // Apply sorting
    result.sort((a, b) => {
      let valA = a[sortField] || "";
      let valB = b[sortField] || "";

      if (sortField === "timestamp") {
        return sortOrder === "asc"
          ? new Date(valA).getTime() - new Date(valB).getTime()
          : new Date(valB).getTime() - new Date(valA).getTime();
      }

      return sortOrder === "asc"
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });

    setFilteredLogs(result);
  }, [allLogs, search, selectedVessel, selectedCommodity, selectedLocation, sortField, sortOrder, currentUserRole, currentUserEmail]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const exportToExcel = () => {
    if (filteredLogs.length === 0) return;

    const tableHeader = `
      <tr style="background-color: #0284c7; color: #ffffff; font-weight: bold; font-family: sans-serif; font-size: 11px;">
        <th style="padding: 6px; border: 1px solid #cbd5e1;">SR. NO.</th>
        <th style="padding: 6px; border: 1px solid #cbd5e1;">GATE PASS NO (GP NO)</th>
        <th style="padding: 6px; border: 1px solid #cbd5e1;">TRUCK NO</th>
        <th style="padding: 6px; border: 1px solid #cbd5e1;">VESSEL NAME</th>
        <th style="padding: 6px; border: 1px solid #cbd5e1;">COMMODITY</th>
        <th style="padding: 6px; border: 1px solid #cbd5e1;">RECEIVER PARTY</th>
        <th style="padding: 6px; border: 1px solid #cbd5e1;">YARD LOCATION</th>
        <th style="padding: 6px; border: 1px solid #cbd5e1;">BILL OF ENTRY (BOE) NO</th>
        <th style="padding: 6px; border: 1px solid #cbd5e1;">TIMESTAMP</th>
        <th style="padding: 6px; border: 1px solid #cbd5e1;">SURVEYOR</th>
      </tr>
    `;

    const tableRows = filteredLogs.map((log, index) => `
      <tr style="font-family: sans-serif; font-size: 11px;">
        <td style="padding: 6px; border: 1px solid #e2e8f0; text-align: center;">${index + 1}</td>
        <td style="padding: 6px; border: 1px solid #e2e8f0; mso-number-format:'\\@'; font-weight: bold;">${log.gp_no}</td>
        <td style="padding: 6px; border: 1px solid #e2e8f0; mso-number-format:'\\@'; font-weight: bold;">${log.truck_no}</td>
        <td style="padding: 6px; border: 1px solid #e2e8f0;">${log.vessel_name || ""}</td>
        <td style="padding: 6px; border: 1px solid #e2e8f0;">${log.commodity || ""}</td>
        <td style="padding: 6px; border: 1px solid #e2e8f0;">${log.receiver_party || ""}</td>
        <td style="padding: 6px; border: 1px solid #e2e8f0; mso-number-format:'\\@';">${log.yard_location || ""}</td>
        <td style="padding: 6px; border: 1px solid #e2e8f0; mso-number-format:'\\@';">${log.boe_no || ""}</td>
        <td style="padding: 6px; border: 1px solid #e2e8f0;">${log.timestamp ? new Date(log.timestamp).toLocaleString() : ""}</td>
        <td style="padding: 6px; border: 1px solid #e2e8f0;">${log.surveyor_name || ""}</td>
      </tr>
    `).join("");

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Yard Movements</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <meta charset="UTF-8">
      </head>
      <body>
        <table border="1" style="border-collapse: collapse; border: 1px solid #cbd5e1;">
          <thead>${tableHeader}</thead>
          <tbody>${tableRows}</tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `adani_logs_export_${Date.now()}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Compute stats totals
  const totalCount = filteredLogs.length;
  const uniqueVessels = new Set(filteredLogs.map((l) => l.vessel_name).filter(Boolean)).size;
  const uniqueTrucks = new Set(filteredLogs.map((l) => l.truck_no).filter(Boolean)).size;

  // Aggregate location stats
  const locationStats: Record<string, number> = {};
  filteredLogs.forEach((l) => {
    if (l.yard_location) {
      locationStats[l.yard_location] = (locationStats[l.yard_location] || 0) + 1;
    }
  });

  // Aggregate commodity stats
  const commodityStats: Record<string, number> = {};
  filteredLogs.forEach((l) => {
    if (l.commodity) {
      commodityStats[l.commodity] = (commodityStats[l.commodity] || 0) + 1;
    }
  });

  // Enforce preview-role permissions matrix limits
  const imp = typeof window !== "undefined" ? localStorage.getItem("dev_impersonated_role") : null;
  const activeUserRole = imp || currentUserRole;
  const canDelete = activeUserRole === "superadmin" || activeUserRole === "admin";
  const canEdit = activeUserRole === "superadmin" || activeUserRole === "admin";

  if (isAuthChecking) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 border-4 border-blue border-t-transparent rounded-full animate-spin"></div>
        <span className="text-xs text-slate-450 font-semibold tracking-widest uppercase animate-pulse">
          Verifying security access...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dashboard Header */}
      <div className="card-panel p-5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide">
            Logistics Movement Dashboard
          </h2>
          <p className="text-[11px] text-slate-450 mt-1 leading-normal font-semibold">
            Real-time yard statistics, PWA logs synchronization status, and surveyor operations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchLogs}
            disabled={isLoading}
            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-405 hover:text-slate-700 transition-colors cursor-pointer bg-white"
            title="Reload database"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
          </button>
          
          <button
            onClick={exportToExcel}
            disabled={filteredLogs.length === 0}
            className="bg-blue hover:bg-sky-700 text-white font-bold uppercase text-[10px] tracking-wider px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:bg-blue/50"
          >
            <Download size={13} />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* 📊 Key Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="card-panel p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Total Placements
            </span>
            <span className="text-2xl font-black text-slate-800 font-mono">
              {isLoading ? "..." : totalCount}
            </span>
          </div>
          <div className="p-3 bg-blue/5 text-blue rounded-lg border border-blue/10">
            <Layers size={20} />
          </div>
        </div>

        <div className="card-panel p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Active Vessels
            </span>
            <span className="text-2xl font-black text-slate-800 font-mono">
              {isLoading ? "..." : uniqueVessels}
            </span>
          </div>
          <div className="p-3 bg-teal-50 text-teal-700 rounded-lg border border-teal-200">
            <Anchor size={20} />
          </div>
        </div>

        <div className="card-panel p-4 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Unique Trucks
            </span>
            <span className="text-2xl font-black text-slate-800 font-mono">
              {isLoading ? "..." : uniqueTrucks}
            </span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg border border-amber-200">
            <Truck size={20} />
          </div>
        </div>
      </div>

      {/* 📊 Visual Charts Grid (Interactive analytics panels) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Yard location fill horizontal chart */}
        <div className="card-panel p-5 rounded-xl space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2">
            Movements by Yard Location
          </h3>
          {isLoading ? (
            <div className="h-32 flex items-center justify-center text-slate-400 text-xs">Loading analytics...</div>
          ) : Object.keys(locationStats).length === 0 ? (
            <div className="h-32 flex items-center justify-center text-slate-450 text-xs uppercase tracking-wider">No location data</div>
          ) : (
            <div className="space-y-3.5 pt-2">
              {Object.entries(locationStats).map(([loc, count]) => {
                const percent = Math.min(100, Math.round((count / totalCount) * 100));
                return (
                  <div key={loc} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="font-mono text-slate-700">{loc}</span>
                      <span className="text-slate-500 font-bold">{count} Placements ({percent}%)</span>
                    </div>
                    {/* SVG/HTML horizontal visual bar */}
                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                      <div
                        style={{ width: `${percent}%` }}
                        className="h-full bg-blue transition-all duration-500 rounded-full"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Commodity horizontal chart */}
        <div className="card-panel p-5 rounded-xl space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2">
            Commodity Allocation
          </h3>
          {isLoading ? (
            <div className="h-32 flex items-center justify-center text-slate-400 text-xs">Loading analytics...</div>
          ) : Object.keys(commodityStats).length === 0 ? (
            <div className="h-32 flex items-center justify-center text-slate-450 text-xs uppercase tracking-wider">No commodity data</div>
          ) : (
            <div className="space-y-3.5 pt-2">
              {Object.entries(commodityStats).map(([comm, count]) => {
                const percent = Math.min(100, Math.round((count / totalCount) * 100));
                return (
                  <div key={comm} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-755 font-bold uppercase">{comm}</span>
                      <span className="text-slate-500 font-bold">{count} ({percent}%)</span>
                    </div>
                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                      <div
                        style={{ width: `${percent}%` }}
                        className="h-full bg-teal-500 transition-all duration-500 rounded-full"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 🔍 Search & Dropdown filters section */}
      <div className="card-panel p-5 rounded-xl space-y-4">
        <div className="flex items-center gap-1 text-slate-600 text-xs font-bold uppercase tracking-wider border-b border-slate-100 pb-2">
          <ListFilter size={15} />
          <span>Filters & Queries</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {/* Search bar */}
          <div className="relative col-span-1 sm:col-span-4">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Truck No, Vessel Name, GP No, or Receiver..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2.5 text-slate-800 text-xs focus:outline-none focus:border-blue transition-colors font-semibold"
            />
          </div>

          {/* Vessel select */}
          <div className="space-y-1">
            <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-450">Vessel</label>
            <select
              value={selectedVessel}
              onChange={(e) => setSelectedVessel(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs text-slate-700 focus:outline-none focus:border-blue"
            >
              <option value="ALL">All Vessels</option>
              {vesselOptions.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          {/* Commodity select */}
          <div className="space-y-1">
            <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-450">Commodity</label>
            <select
              value={selectedCommodity}
              onChange={(e) => setSelectedCommodity(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs text-slate-700 focus:outline-none focus:border-blue"
            >
              <option value="ALL">All Commodities</option>
              {commodityOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Location select */}
          <div className="space-y-1">
            <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-450">Yard location</label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-xs text-slate-700 focus:outline-none focus:border-blue"
            >
              <option value="ALL">All Locations</option>
              {locationOptions.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          {/* Clear button */}
          <div className="flex items-end">
            <button
              onClick={() => {
                setSearch("");
                setSelectedVessel("ALL");
                setSelectedCommodity("ALL");
                setSelectedLocation("ALL");
              }}
              className="w-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 font-bold uppercase text-[10px] py-2 rounded-lg transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* 📄 Main Logs Table with Advanced Column Sorting */}
      <div className="card-panel rounded-xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 border-4 border-blue border-t-transparent rounded-full animate-spin"></div>
            <span className="text-xs text-slate-450 font-semibold tracking-widest uppercase animate-pulse">
              Loading movements...
            </span>
          </div>
        ) : error ? (
          <div className="p-12 text-center text-red-650 text-xs font-semibold leading-loose space-y-2">
            <div>⚠️ {error}</div>
            <button
              onClick={fetchLogs}
              className="bg-slate-900 border border-slate-900 text-white font-bold uppercase text-[10px] px-4 py-1.5 rounded hover:bg-slate-800"
            >
              Try Again
            </button>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs font-semibold uppercase tracking-wider">
            No movements matching active filter configurations
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4 cursor-pointer hover:bg-slate-100/70 select-none" onClick={() => handleSort("gp_no")}>
                    <div className="flex items-center gap-1.5">
                      <span>GP No</span>
                      <ArrowUpDown size={11} className={sortField === "gp_no" ? "text-blue" : "text-slate-400"} />
                    </div>
                  </th>
                  <th className="py-3.5 px-4 cursor-pointer hover:bg-slate-100/70 select-none" onClick={() => handleSort("truck_no")}>
                    <div className="flex items-center gap-1.5">
                      <span>Truck No</span>
                      <ArrowUpDown size={11} className={sortField === "truck_no" ? "text-blue" : "text-slate-400"} />
                    </div>
                  </th>
                  <th className="py-3.5 px-4 cursor-pointer hover:bg-slate-100/70 select-none" onClick={() => handleSort("vessel_name")}>
                    <div className="flex items-center gap-1.5">
                      <span>Vessel Name</span>
                      <ArrowUpDown size={11} className={sortField === "vessel_name" ? "text-blue" : "text-slate-400"} />
                    </div>
                  </th>
                  <th className="py-3.5 px-4">Commodity</th>
                  <th className="py-3.5 px-4">Receiver</th>
                  <th className="py-3.5 px-4 cursor-pointer hover:bg-slate-100/70 select-none" onClick={() => handleSort("yard_location")}>
                    <div className="flex items-center gap-1.5">
                      <span>Yard Loc</span>
                      <ArrowUpDown size={11} className={sortField === "yard_location" ? "text-blue" : "text-slate-400"} />
                    </div>
                  </th>
                  <th className="py-3.5 px-4">BOE No</th>
                  <th className="py-3.5 px-4 cursor-pointer hover:bg-slate-100/70 select-none" onClick={() => handleSort("timestamp")}>
                    <div className="flex items-center gap-1.5">
                      <span>Timestamp</span>
                      <ArrowUpDown size={11} className={sortField === "timestamp" ? "text-blue" : "text-slate-400"} />
                    </div>
                  </th>
                  {(currentUserRole === "superadmin" || currentUserRole === "admin") && (
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700 bg-white">
                {filteredLogs.map((log) => (
                  <tr key={log.gp_no} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100">
                    <td className="py-3.5 px-4 font-mono font-bold text-blue">{log.gp_no}</td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-800">{log.truck_no}</td>
                    <td className="py-3.5 px-4">{log.vessel_name || "—"}</td>
                    <td className="py-3.5 px-4">
                      <span className="bg-slate-100 text-[10px] px-2 py-0.5 rounded text-slate-650 font-bold">
                        {log.commodity || "—"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 max-w-[150px] truncate font-medium" title={log.receiver_party}>
                      {log.receiver_party || "—"}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">{log.yard_location || "—"}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">{log.boe_no || "—"}</td>
                    <td className="py-3.5 px-4 text-slate-500 font-mono">
                      {log.timestamp ? new Date(log.timestamp).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : "—"}
                    </td>
                    {(currentUserRole === "superadmin" || currentUserRole === "admin") && (
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2.5">
                          {/* Edit button */}
                          {canEdit && (
                            <button
                              onClick={() => handleEditClick(log)}
                              className="p-1 hover:bg-blue/10 text-slate-400 hover:text-blue rounded transition-colors cursor-pointer"
                              title="Edit log entry"
                            >
                              <Edit2 size={13} />
                            </button>
                          )}
                          
                          {/* Delete button */}
                          {canDelete && (
                            <button
                              onClick={() => handleDeleteLogEntry(log.gp_no)}
                              className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                              title="Delete log entry"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}

                          {/* Unlock trigger */}
                          {log.timestamp && (Date.now() - new Date(log.timestamp).getTime() > 30 * 60 * 1000) ? (
                            log.allow_surveyor_edit ? (
                              <span className="text-[9px] text-teal-600 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider select-none animate-pulse">
                                Unlocked
                              </span>
                            ) : (
                              <button
                                onClick={() => handleUnlockForSurveyor(log.gp_no)}
                                disabled={unlockingGp === log.gp_no}
                                className="bg-white border border-slate-200 hover:border-blue hover:text-blue text-slate-555 font-bold uppercase text-[9px] px-1.5 py-0.5 rounded cursor-pointer inline-flex items-center gap-1 leading-none transition-colors"
                                title="Temporary allow Surveyor edit correction"
                              >
                                <Unlock size={9} />
                                <span>Unlock</span>
                              </button>
                            )
                          ) : (
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wide bg-slate-50 border border-slate-150 px-1.5 py-0.5 rounded select-none">
                              Editable
                            </span>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 📝 Dashboard Log Edit Modal Overlay */}
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
