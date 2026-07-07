"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle, HardDrive, RefreshCcw, UserPlus, Lock, ClipboardCopy, Send, Eye, Shield, Users, MapPin, Edit2, MousePointerClick, Settings, Sliders, Mail, Search, Laptop, Globe, Server, CheckCircle } from "lucide-react";

interface UserAccount {
  uid: string;
  email: string;
  role: string;
  disabled: boolean;
  createdAt?: string;
  lastSignIn?: string;
}

interface PermissionConfig {
  access_log_entry: boolean;
  access_dashboard: boolean;
  delete_logs: boolean;
  export_csv: boolean;
}

interface AuditLog {
  id: string;
  eventType: string;
  email: string;
  timestamp: string;
  ip: string;
  userAgent: string;
  gps?: {
    latitude: number | null;
    longitude: number | null;
    mapsLink: string | null;
  };
  metadata?: {
    keystroke_telemetry?: Array<{
      inputName: string;
      keyCount: number;
      timeSpentMs: number;
    }>;
    reason?: string;
    element?: string;
    text?: string;
    clientX?: number;
    clientY?: number;
    screenX?: number;
    screenY?: number;
    pagePath?: string;
  };
}

export default function DeveloperConsole() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"users" | "permissions" | "audit" | "emails" | "telemetry" | "system" | "database">("users");
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);

  // Email management states
  const [emailSearchQuery, setEmailSearchQuery] = useState<string>("");
  const [emailStatusFilter, setEmailStatusFilter] = useState<string>("ALL");
  const [emailTypeFilter, setEmailTypeFilter] = useState<string>("ALL");
  const [expandedEmailLogId, setExpandedEmailLogId] = useState<string | null>(null);
  const [testEmailTarget, setTestEmailTarget] = useState<string>("");
  const [isTestSending, setIsTestSending] = useState<boolean>(false);

  // Data states
  const [usersList, setUsersList] = useState<UserAccount[]>([]);
  const [permissions, setPermissions] = useState<Record<string, PermissionConfig>>({
    surveyor: { access_log_entry: true, access_dashboard: false, delete_logs: false, export_csv: false },
    admin: { access_log_entry: true, access_dashboard: true, delete_logs: false, export_csv: true },
    superadmin: { access_log_entry: true, access_dashboard: true, delete_logs: true, export_csv: true },
  });
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [dbLogs, setDbLogs] = useState<any[]>([]);
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  
  // Status message
  const [status, setStatus] = useState<{
    type: "success" | "error" | null;
    text: string;
  }>({ type: null, text: "" });

  // Creation forms states
  const [newUserEmail, setNewUserEmail] = useState<string>("");
  const [newUserPassword, setNewUserPassword] = useState<string>("");
  const [newUserRole, setNewUserRole] = useState<string>("surveyor");
  const [isUserCreating, setIsUserCreating] = useState<boolean>(false);

  // Link generation states
  const [resetTargetEmail, setResetTargetEmail] = useState<string>("");
  const [generatedLink, setGeneratedLink] = useState<string>("");

  // Diagnostics states
  const [offlineQueueCount, setOfflineQueueCount] = useState<number>(0);
  const [isDataLoading, setIsDataLoading] = useState<boolean>(false);

  // Edit log states
  const [editingLog, setEditingLog] = useState<any | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  // System config controls states
  const [maintMode, setMaintMode] = useState<boolean>(false);
  const [systemNotif, setSystemNotif] = useState<any | null>(null);
  const [newNotifTitle, setNewNotifTitle] = useState<string>("");
  const [newNotifMessage, setNewNotifMessage] = useState<string>("");
  const [isSystemUpdating, setIsSystemUpdating] = useState<boolean>(false);
  const [isSendingReport, setIsSendingReport] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Enforce developer role based on real session claims (ignores client impersonation for security)
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

        if (data.user.role !== "superadmin") {
          if (typeof window !== "undefined" && (window as any).showSystemAlert) {
            (window as any).showSystemAlert("Access denied. Authorized Developer claims are required.", "error");
          } else {
            alert("Access denied. Authorized Developer claims are required.");
          }
          router.push("/login");
          return;
        }

        const imp = localStorage.getItem("dev_impersonated_role");
        if (imp && imp !== "superadmin") {
          if (typeof window !== "undefined" && (window as any).showSystemAlert) {
            (window as any).showSystemAlert(`Access denied. Your active role preview ('${imp}') does not have access to the Developer Console.`, "error");
          } else {
            alert(`Access denied. Your active role preview ('${imp}') does not have access to the Developer Console.`);
          }
          router.push("/profile");
          return;
        }

        setIsAuthChecking(false);
      } catch (err) {
        console.error("Auth verification failed:", err);
        router.push("/login");
      }
    };

    verifyAuth();

    const interval = setInterval(() => {
      const queueRaw = localStorage.getItem("offline_logs_queue");
      setOfflineQueueCount(queueRaw ? JSON.parse(queueRaw).length : 0);
    }, 2000);

    return () => clearInterval(interval);
  }, [router]);

  // Load page data dynamically based on active tab selection
  useEffect(() => {
    if (isAuthChecking) return;
    loadTabContent();
  }, [activeTab, isAuthChecking]);

  const loadTabContent = async () => {
    setIsDataLoading(true);
    setStatus({ type: null, text: "" });
    try {
      if (activeTab === "users") {
        const res = await fetch("/api/developer/users");
        if (res.ok) {
          const data = await res.json();
          setUsersList(data);
        } else {
          const errData = await res.json();
          setStatus({ type: "error", text: errData.error || "Failed to load user directory." });
        }
      } else if (activeTab === "permissions") {
        const res = await fetch("/api/developer/permissions");
        if (res.ok) {
          const data = await res.json();
          setPermissions(data);
        }
      } else if (activeTab === "audit" || activeTab === "telemetry") {
        const res = await fetch("/api/developer/audit-logs");
        if (res.ok) {
          const data = await res.json();
          setAuditLogs(data);
        } else {
          const errData = await res.json();
          setStatus({ type: "error", text: errData.error || "Failed to load system audit trails." });
        }
      } else if (activeTab === "system") {
        const configRes = await fetch("/api/system/config");
        if (configRes.ok) {
          const data = await configRes.json();
          setMaintMode(!!data.maintenanceMode);
          setSystemNotif(data.notification);
        } else {
          setStatus({ type: "error", text: "Failed to query maintenance/alert configurations." });
        }
      } else if (activeTab === "emails") {
        const res = await fetch("/api/developer/email-logs");
        if (res.ok) {
          const data = await res.json();
          setEmailLogs(data);
        } else {
          const errData = await res.json();
          setStatus({ type: "error", text: errData.error || "Failed to load email logs." });
        }
      } else if (activeTab === "database") {
        const res = await fetch("/api/get-logs");
        if (res.ok) {
          const data = await res.json();
          setDbLogs(Array.isArray(data) ? data : []);
        } else {
          setStatus({ type: "error", text: "Failed to load logs database." });
        }
      }
    } catch (err) {
      setStatus({ type: "error", text: "Connection error loading console data." });
    } finally {
      setIsDataLoading(false);
    }
  };

  // Manual SMTP relay verification dispatch handler
  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmailTarget.trim()) {
      setStatus({ type: "error", text: "Recipient email address is required." });
      return;
    }

    setIsTestSending(true);
    setStatus({ type: null, text: "" });

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testEmailTarget.trim() }),
      });

      const result = await res.json();

      if (res.ok) {
        setStatus({
          type: "success",
          text: `SMTP Diagnostic notification successfully sent to: ${testEmailTarget}`,
        });
        setTestEmailTarget("");
        // Reload emails list to showcase new tracking entry!
        const logRes = await fetch("/api/developer/email-logs");
        if (logRes.ok) {
          const logData = await logRes.json();
          setEmailLogs(logData);
        }
      } else {
        setStatus({ type: "error", text: result.error || "SMTP mail server dispatch failed." });
      }
    } catch (err) {
      setStatus({ type: "error", text: "Network error sending test email." });
    } finally {
      setIsTestSending(false);
    }
  };

  // User creation submit handler
  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ type: null, text: "" });
    setIsUserCreating(true);

    try {
      const res = await fetch("/api/create-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: newUserEmail, password: newUserPassword, role: newUserRole }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus({ type: "success", text: `Staff account ${newUserEmail} registered successfully.` });
        setNewUserEmail("");
        setNewUserPassword("");
        loadTabContent(); // Refresh list
      } else {
        setStatus({ type: "error", text: data.error || "Failed to register account." });
      }
    } catch (err) {
      setStatus({ type: "error", text: "Network failure calling user registration." });
    } finally {
      setIsUserCreating(false);
    }
  };

  // Modify user role dynamically
  const handleUserRoleChange = async (uid: string, targetRole: string) => {
    setStatus({ type: null, text: "" });
    try {
      const res = await fetch("/api/developer/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "set-role", targetUid: uid, role: targetRole }),
      });

      const data = await res.json();
      if (res.ok) {
        setStatus({ type: "success", text: "User role changed successfully in database." });
        setUsersList(usersList.map((u) => (u.uid === uid ? { ...u, role: targetRole } : u)));
      } else {
        setStatus({ type: "error", text: data.error || "Failed to update role claims." });
      }
    } catch (err) {
      setStatus({ type: "error", text: "Connection error saving user claims." });
    }
  };

  const exportWholeDatabaseToExcel = () => {
    if (dbLogs.length === 0) return;

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

    const tableRows = dbLogs.map((log, index) => `
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
                <x:Name>Complete Database Backup</x:Name>
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
    link.download = `adani_complete_database_backup_${Date.now()}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Suspend/enable account toggle
  const handleUserSuspensionToggle = async (uid: string, currentStatus: boolean) => {
    setStatus({ type: null, text: "" });
    const action = currentStatus ? "unsuspend" : "suspend";
    try {
      const res = await fetch("/api/developer/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, targetUid: uid }),
      });

      const data = await res.json();
      if (res.ok) {
        setStatus({ type: "success", text: `User account login successfully ${currentStatus ? "enabled" : "suspended"}.` });
        setUsersList(usersList.map((u) => (u.uid === uid ? { ...u, disabled: !currentStatus } : u)));
      } else {
        setStatus({ type: "error", text: data.error || "Failed to modify login state." });
      }
    } catch (err) {
      setStatus({ type: "error", text: "Network failure toggling login suspension state." });
    }
  };

  // Direct reset link generation
  const handleGenerateResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ type: null, text: "" });
    setGeneratedLink("");

    try {
      const res = await fetch("/api/generate-reset-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: resetTargetEmail }),
      });

      const data = await res.json();
      if (res.ok) {
        setGeneratedLink(data.resetLink);
        setStatus({ type: "success", text: "Password reset link generated." });
      } else {
        setStatus({ type: "error", text: data.error || "Failed to generate link." });
      }
    } catch (err) {
      setStatus({ type: "error", text: "Network failure generating link." });
    }
  };

  // Save permission matrix configuration
  const handlePermissionSave = async () => {
    setStatus({ type: null, text: "" });
    try {
      const res = await fetch("/api/developer/permissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(permissions),
      });

      if (res.ok) {
        setStatus({ type: "success", text: "Permissions matrix configuration updated successfully." });
      } else {
        const data = await res.json();
        setStatus({ type: "error", text: data.error || "Failed to update configuration." });
      }
    } catch (err) {
      setStatus({ type: "error", text: "Connection error saving permissions config." });
    }
  };

  // Toggle single permission checkbox
  const handlePermissionToggle = (roleKey: string, permKey: keyof PermissionConfig) => {
    setPermissions((prev) => ({
      ...prev,
      [roleKey]: {
        ...prev[roleKey],
        [permKey]: !prev[roleKey][permKey],
      },
    }));
  };

  const handleToggleMaintenance = async () => {
    setIsSystemUpdating(true);
    setStatus({ type: null, text: "" });
    try {
      const res = await fetch("/api/system/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle-maintenance", maintenanceMode: !maintMode }),
      });
      if (res.ok) {
        setMaintMode(!maintMode);
        setStatus({ type: "success", text: `Maintenance Mode is now successfully ${!maintMode ? "ENABLED" : "DISABLED"}.` });
      } else {
        const data = await res.json();
        setStatus({ type: "error", text: data.error || "Failed to toggle maintenance Mode." });
      }
    } catch (e) {
      setStatus({ type: "error", text: "Network error toggle maintenance configuration." });
    } finally {
      setIsSystemUpdating(false);
    }
  };

  const handlePublishNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSystemUpdating(true);
    setStatus({ type: null, text: "" });
    try {
      const res = await fetch("/api/system/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "publish-notification",
          title: newNotifTitle,
          message: newNotifMessage,
        }),
      });
      if (res.ok) {
        setNewNotifTitle("");
        setNewNotifMessage("");
        setStatus({ type: "success", text: "System-wide notification successfully published and locked." });
        
        // Reload system configs to fetch current reader lists
        const configRes = await fetch("/api/system/config");
        if (configRes.ok) {
          const configData = await configRes.json();
          setSystemNotif(configData.notification);
        }
      } else {
        const data = await res.json();
        setStatus({ type: "error", text: data.error || "Failed to publish notification." });
      }
    } catch (e) {
      setStatus({ type: "error", text: "Connection error broadcasting announcement." });
    } finally {
      setIsSystemUpdating(false);
    }
  };

  const handleClearNotification = async () => {
    setIsSystemUpdating(true);
    setStatus({ type: null, text: "" });
    try {
      const res = await fetch("/api/system/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear-notification" }),
      });
      if (res.ok) {
        setSystemNotif(null);
        setStatus({ type: "success", text: "System announcement successfully deactivated." });
      } else {
        const data = await res.json();
        setStatus({ type: "error", text: data.error || "Failed to clear notification." });
      }
    } catch (e) {
      setStatus({ type: "error", text: "Network error deactivating alert." });
    } finally {
      setIsSystemUpdating(false);
    }
  };

  const handleSendReport = async () => {
    setIsSendingReport(true);
    setStatus({ type: null, text: "" });
    try {
      const res = await fetch("/api/system/send-report", {
        method: "POST"
      });
      const data = await res.json();
      if (res.ok) {
        setStatus({
          type: "success",
          text: `Daily logistics report and database spreadsheet successfully emailed! (${data.metrics.totalLogs} total logs / ${data.metrics.submittedToday} submitted today).`
        });
      } else {
        setStatus({
          type: "error",
          text: data.error || "Failed to send backup report."
        });
      }
    } catch (err) {
      setStatus({
        type: "error",
        text: "Mail server connection failure triggering backup."
      });
    } finally {
      setIsSendingReport(false);
    }
  };

  // Delete movement logs
  const handleDeleteLogEntry = async (gp_no: string) => {
    const performDelete = async () => {
      setStatus({ type: null, text: "" });
      try {
        const res = await fetch(`/api/delete-log?gp_no=${gp_no}`, {
          method: "DELETE",
        });
        if (res.ok) {
          setStatus({ type: "success", text: `Log GP ${gp_no} permanently deleted from database.` });
          setDbLogs(dbLogs.filter((l) => l.gp_no !== gp_no));
        } else {
          const data = await res.json();
          setStatus({ type: "error", text: data.error || "Failed to delete log." });
        }
      } catch (err) {
        setStatus({ type: "error", text: "Connection error deleting log record." });
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
        setStatus({ type: "success", text: `Log ${editFormData.gp_no} updated successfully.` });
        loadTabContent(); // Refresh logs database
      } else {
        setEditError(data.error || "Failed to update database entry.");
      }
    } catch (err) {
      setEditError("Connection error saving database updates.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClearLocalDiagnosticQueue = () => {
    const performClear = () => {
      localStorage.removeItem("offline_logs_queue");
      window.dispatchEvent(new Event("queue-updated"));
      setOfflineQueueCount(0);
      setStatus({ type: "success", text: "Local diagnostic queue cleared." });
    };

    if (typeof window !== "undefined" && (window as any).showSystemConfirm) {
      (window as any).showSystemConfirm("Are you sure you want to erase all cached logs on this device?", performClear);
    } else {
      if (window.confirm("Erase all cached logs on this device?")) {
        performClear();
      }
    }
  };

  const handleCopyLink = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      if (typeof window !== "undefined" && (window as any).showSystemAlert) {
        (window as any).showSystemAlert("Reset link copied to clipboard!", "success");
      } else {
        alert("Reset link copied to clipboard!");
      }
    }
  };

  // Email Logs filter logic
  const filteredEmailLogs = emailLogs.filter((log) => {
    const matchesSearch =
      log.to.toLowerCase().includes(emailSearchQuery.toLowerCase()) ||
      log.subject.toLowerCase().includes(emailSearchQuery.toLowerCase()) ||
      log.type.toLowerCase().includes(emailSearchQuery.toLowerCase());

    const matchesStatus =
      emailStatusFilter === "ALL" ||
      (emailStatusFilter === "OPENED" && log.status === "OPENED") ||
      (emailStatusFilter === "SENT" && log.status === "SENT");

    const matchesType = emailTypeFilter === "ALL" || log.type === emailTypeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  const totalSent = emailLogs.length;
  const openedLogs = emailLogs.filter((log) => log.status === "OPENED");
  const totalOpens = emailLogs.reduce((acc, log) => acc + (log.opens?.length || 0), 0);
  const openRate = totalSent > 0 ? Math.round((openedLogs.length / totalSent) * 100) : 0;
  const proxyOpens = emailLogs.reduce(
    (acc, log) => acc + (log.opens?.filter((op: any) => op.isProxy).length || 0),
    0
  );

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
      {/* Console Header */}
      <div className="card-panel p-5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-850 uppercase tracking-wide">
              Developer Console
            </h2>
            <span className="bg-red-50 text-red-600 border border-red-200 text-[9px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider">
              System Admin
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            System account configurations, security matrices, and real-time audit databases.
          </p>
        </div>

        {/* Developer info */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-right">
          <span className="text-[9px] text-slate-400 uppercase tracking-wider block font-bold">
            Authorized Account
          </span>
          <span className="text-xs text-blue font-mono font-bold">
            veer.b.builds@gmail.com
          </span>
        </div>
      </div>

      {/* Dynamic Status message alert */}
      {status.text && (
        <div
          className={`p-4 rounded-xl border text-xs leading-normal flex items-start gap-2.5 ${
            status.type === "success"
              ? "bg-teal-50 border-teal-200 text-teal-700"
              : "bg-red-50 border-red-200 text-red-600"
          }`}
        >
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <span>{status.text}</span>
        </div>
      )}

      {/* 🚀 TWO-COLUMN SIDE SLIDE LAYOUT (Inner console sub-menu) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Left Side Slide sub-navigation list */}
        <div className="md:col-span-1 space-y-2">
          <div className="card-panel p-4 rounded-xl space-y-1.5 shadow-sm">
            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none pb-2 border-b border-slate-100 mb-2">
              Console Navigation
            </span>
            <button
              onClick={() => setActiveTab("users")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                activeTab === "users"
                  ? "bg-blue text-white shadow-md shadow-blue/20"
                  : "text-slate-550 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              <Users size={14} />
              <span>Staff Directory</span>
            </button>
            <button
              onClick={() => setActiveTab("permissions")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                activeTab === "permissions"
                  ? "bg-blue text-white shadow-md shadow-blue/20"
                  : "text-slate-550 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              <Shield size={14} />
              <span>Access Matrix</span>
            </button>
            <button
              onClick={() => setActiveTab("audit")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                activeTab === "audit"
                  ? "bg-blue text-white shadow-md shadow-blue/20"
                  : "text-slate-550 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              <Eye size={14} />
              <span>System Audits</span>
            </button>
            <button
              onClick={() => setActiveTab("telemetry")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                activeTab === "telemetry"
                  ? "bg-blue text-white shadow-md shadow-blue/20"
                  : "text-slate-555 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              <MousePointerClick size={14} />
              <span>User Clicks</span>
            </button>
            <button
              onClick={() => setActiveTab("emails")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                activeTab === "emails"
                  ? "bg-blue text-white shadow-md shadow-blue/20"
                  : "text-slate-555 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              <Mail size={14} />
              <span>Email Logs</span>
            </button>
            <button
              onClick={() => setActiveTab("system")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                activeTab === "system"
                  ? "bg-blue text-white shadow-md shadow-blue/20"
                  : "text-slate-555 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              <Sliders size={14} />
              <span>System Controls</span>
            </button>
            <button
              onClick={() => setActiveTab("database")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                activeTab === "database"
                  ? "bg-blue text-white shadow-md shadow-blue/20"
                  : "text-slate-550 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              <HardDrive size={14} />
              <span>Database Info</span>
            </button>
          </div>
        </div>

        {/* Right Tab Content Viewer */}
        <div className="md:col-span-3 space-y-6">
          {/* 👤 Tab 1: Staff Directory & Account registrations */}
          {activeTab === "users" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
              {/* Create login account form */}
              <div className="lg:col-span-1 space-y-6">
                <div className="card-panel p-5 rounded-xl space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                    <UserPlus size={16} className="text-blue" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Register Staff Login
                    </h3>
                  </div>

                  <form onSubmit={handleCreateUserSubmit} className="space-y-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Email Address
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="surveyor1@masmarine.com"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        className="w-full bg-slate-55 border border-slate-200 rounded-lg px-3 py-2 text-slate-850 text-xs focus:outline-none focus:border-blue transition-colors font-semibold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Initial Password
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="Min 6 characters"
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        className="w-full bg-slate-55 border border-slate-200 rounded-lg px-3 py-2 text-slate-850 text-xs focus:outline-none focus:border-blue transition-colors"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Select Account Role
                      </label>
                      <select
                        value={newUserRole}
                        onChange={(e) => setNewUserRole(e.target.value)}
                        className="w-full bg-slate-55 border border-slate-200 rounded-lg px-3.5 py-2 text-slate-700 text-xs focus:outline-none focus:border-blue transition-colors"
                      >
                        <option value="surveyor">Surveyor</option>
                        <option value="admin">Admin</option>
                        <option value="superadmin">Super Admin / Developer</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={isUserCreating}
                      className="w-full bg-blue text-white font-bold uppercase text-xs tracking-wider py-2.5 rounded-lg hover:bg-sky-700 transition-colors btn-touch cursor-pointer disabled:bg-blue/50"
                    >
                      {isUserCreating ? "Creating Account..." : "Create Account"}
                    </button>
                  </form>
                </div>

                {/* Direct recovery generator */}
                <div className="card-panel p-5 rounded-xl space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                    <Send size={15} className="text-blue" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Password Link Engine
                    </h3>
                  </div>

                  <form onSubmit={handleGenerateResetSubmit} className="space-y-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        User Email
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="Enter email to get link"
                        value={resetTargetEmail}
                        onChange={(e) => setResetTargetEmail(e.target.value)}
                        className="w-full bg-slate-55 border border-slate-200 rounded-lg px-3 py-2 text-slate-850 text-xs focus:outline-none focus:border-blue transition-colors"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-white border border-slate-200 text-slate-755 font-bold uppercase text-[10px] tracking-wider py-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      Generate Link
                    </button>
                  </form>

                  {generatedLink && (
                    <div className="bg-slate-55 p-3 rounded-lg border border-blue/10 space-y-2">
                      <span className="text-[9px] text-blue font-bold uppercase block tracking-wider">
                        Reset Link URL:
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={generatedLink}
                          className="w-full bg-transparent border-none text-[10px] text-slate-650 focus:outline-none font-mono truncate"
                        />
                        <button
                          onClick={handleCopyLink}
                          className="text-blue hover:text-sky-700 p-1 rounded cursor-pointer"
                        >
                          <ClipboardCopy size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Directory database table */}
              <div className="lg:col-span-2 space-y-6">
                <div className="card-panel rounded-xl overflow-hidden shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 p-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Registered Staff accounts
                    </h3>
                    <button
                      onClick={loadTabContent}
                      disabled={isDataLoading}
                      className="p-1.5 border border-slate-200 rounded hover:bg-slate-50 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      <RefreshCcw size={12} className={isDataLoading ? "animate-spin" : ""} />
                    </button>
                  </div>

                  {isDataLoading ? (
                    <div className="p-12 text-center text-xs text-slate-405 tracking-widest uppercase animate-pulse">
                      Querying account credentials...
                    </div>
                  ) : usersList.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 text-xs uppercase tracking-wider">
                      No registered users found
                    </div>
                  ) : (
                    <div className="overflow-x-auto w-full">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            <th className="py-3 px-4">Staff Email</th>
                            <th className="py-3 px-4">Role Claims</th>
                            <th className="py-3 px-4">Login Status</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                          {usersList.map((user) => (
                            <tr key={user.uid} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-3.5 px-4 font-mono font-bold truncate max-w-[170px]" title={user.email}>
                                {user.email}
                              </td>
                              <td className="py-3.5 px-4">
                                <select
                                  value={user.role}
                                  onChange={(e) => handleUserRoleChange(user.uid, e.target.value)}
                                  disabled={user.email === "veer.b.builds@gmail.com"}
                                  className="bg-slate-55 border border-slate-200 rounded px-1.5 py-0.5 text-[11px] font-bold text-slate-705 focus:outline-none focus:border-blue cursor-pointer disabled:bg-slate-100 disabled:text-slate-450"
                                >
                                  <option value="surveyor">Surveyor</option>
                                  <option value="admin">Admin</option>
                                  <option value="superadmin">Super Admin</option>
                                </select>
                              </td>
                              <td className="py-3.5 px-4">
                                <span
                                  className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                    user.disabled
                                      ? "bg-red-50 text-red-600 border border-red-100"
                                      : "bg-teal-50 text-teal-700 border border-teal-100"
                                  }`}
                                >
                                  {user.disabled ? "Suspended" : "Active"}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-right space-x-2">
                                <button
                                  onClick={() => handleUserSuspensionToggle(user.uid, user.disabled)}
                                  disabled={user.email === "veer.b.builds@gmail.com"}
                                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                                    user.disabled
                                      ? "bg-teal-50 border border-teal-100 text-teal-700 hover:bg-teal-100"
                                      : "bg-red-50 border border-red-100 text-red-655 hover:bg-red-100"
                                  }`}
                                >
                                  {user.disabled ? "Restore" : "Suspend"}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 🛡️ Tab 2: Dynamic Role Permissions Matrix Grid */}
          {activeTab === "permissions" && (
            <div className="card-panel rounded-xl overflow-hidden space-y-4 p-5 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-755">
                  Role Access & Permissions Matrix
                </h3>
                <span className="text-[9px] bg-red-50 border border-red-100 text-red-600 px-2 py-0.5 rounded font-bold uppercase tracking-widest leading-none">
                  Real-Time Enforced
                </span>
              </div>

              <div className="overflow-x-auto w-full border border-slate-150 rounded-lg">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-555">
                      <th className="py-3.5 px-4">Role</th>
                      <th className="py-3.5 px-4 text-center">Form Log Entry</th>
                      <th className="py-3.5 px-4 text-center">Dashboard Access</th>
                      <th className="py-3.5 px-4 text-center">Delete Logs</th>
                      <th className="py-3.5 px-4 text-center">Export Sheets</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700 bg-white">
                    {Object.keys(permissions).map((roleKey) => (
                      <tr key={roleKey} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-4 font-bold capitalize text-slate-800">{roleKey}</td>
                        <td className="py-4 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={permissions[roleKey].access_log_entry}
                            onChange={() => handlePermissionToggle(roleKey, "access_log_entry")}
                            disabled={roleKey === "superadmin"}
                            className="h-4 w-4 rounded border-slate-300 text-blue focus:ring-blue cursor-pointer"
                          />
                        </td>
                        <td className="py-4 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={permissions[roleKey].access_dashboard}
                            onChange={() => handlePermissionToggle(roleKey, "access_dashboard")}
                            disabled={roleKey === "superadmin"}
                            className="h-4 w-4 rounded border-slate-300 text-blue focus:ring-blue cursor-pointer"
                          />
                        </td>
                        <td className="py-4 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={permissions[roleKey].delete_logs}
                            onChange={() => handlePermissionToggle(roleKey, "delete_logs")}
                            disabled={roleKey === "superadmin"}
                            className="h-4 w-4 rounded border-slate-300 text-blue focus:ring-blue cursor-pointer"
                          />
                        </td>
                        <td className="py-4 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={permissions[roleKey].export_csv}
                            onChange={() => handlePermissionToggle(roleKey, "export_csv")}
                            disabled={roleKey === "superadmin"}
                            className="h-4 w-4 rounded border-slate-300 text-blue focus:ring-blue cursor-pointer"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pt-2 text-right">
                <button
                  onClick={handlePermissionSave}
                  className="bg-blue text-white font-bold uppercase text-[10px] tracking-widest px-6 py-2.5 rounded-lg hover:bg-sky-700 transition-colors btn-touch cursor-pointer"
                >
                  Save Matrix Configuration
                </button>
              </div>
            </div>
          )}

          {/* 👁️ Tab 3: System Audits & Keystroke Telemetry Logs */}
          {activeTab === "audit" && (
            <div className="card-panel rounded-xl overflow-hidden p-5 space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  System Audit Trails & Telemetry Logs
                </h3>
                <button
                  onClick={loadTabContent}
                  disabled={isDataLoading}
                  className="p-1.5 border border-slate-200 rounded hover:bg-slate-50 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <RefreshCcw size={12} className={isDataLoading ? "animate-spin" : ""} />
                </button>
              </div>

              {isDataLoading ? (
                <div className="p-12 text-center text-xs text-slate-455 tracking-widest uppercase animate-pulse">
                  Retrieving audit databases...
                </div>
              ) : auditLogs.filter((l) => l.eventType !== "USER_CLICK").length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs uppercase tracking-wider">
                  No security audit logs captured yet
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {auditLogs
                    .filter((l) => l.eventType !== "USER_CLICK")
                    .map((log) => (
                    <div
                      key={log.id}
                      className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3 text-xs leading-normal hover:border-slate-300 transition-all shadow-sm"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-2 gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-[9px] font-black uppercase px-2 py-0.5 rounded tracking-wider ${
                              log.eventType.includes("SUCCESS") || log.eventType.includes("SUBMIT")
                                ? "bg-teal-50 text-teal-700 border border-teal-100"
                                : "bg-red-50 text-red-650 border border-red-100"
                            }`}
                          >
                            {log.eventType}
                          </span>
                          <span className="font-bold text-slate-750 font-mono">{log.email}</span>
                        </div>

                        <span className="text-[10px] text-slate-455 font-mono">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] text-slate-550">
                        <div className="space-y-0.5">
                          <span className="block font-bold text-[9px] text-slate-400 uppercase tracking-wide">Network Data</span>
                          <span>IP Address: <span className="font-mono text-slate-750 font-semibold">{log.ip}</span></span>
                          <span className="block truncate max-w-[200px]" title={log.userAgent}>Agent: {log.userAgent}</span>
                        </div>

                        <div className="space-y-0.5">
                          <span className="block font-bold text-[9px] text-slate-400 uppercase tracking-wide">GPS Geolocation</span>
                          {log.gps && log.gps.latitude !== null && log.gps.longitude !== null ? (
                            <a
                              href={log.gps.mapsLink || "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
                            >
                              <MapPin size={11} />
                              <span>Lat: {log.gps.latitude.toFixed(5)}, Lng: {log.gps.longitude.toFixed(5)}</span>
                            </a>
                          ) : (
                            <span className="text-slate-400">Location Denied / Unavailable</span>
                          )}
                        </div>

                        <div className="space-y-0.5 md:col-span-1">
                          <span className="block font-bold text-[9px] text-slate-400 uppercase tracking-wide">Keystroke telemetry</span>
                          {log.metadata?.keystroke_telemetry && log.metadata.keystroke_telemetry.length > 0 ? (
                            <div className="space-y-1 pt-1">
                              {log.metadata.keystroke_telemetry.map((tele, idx) => (
                                <div key={idx} className="flex justify-between font-mono text-[9px] bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-500">
                                  <span className="font-bold text-slate-600">{tele.inputName}:</span>
                                  <span>{tele.keyCount} keys | {(tele.timeSpentMs / 1000).toFixed(1)}s</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400">No telemetry logged</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 🖱️ Tab 5: User Click Telemetry (No direct IP display, supports Link IP lookups) */}
          {activeTab === "telemetry" && (
            <div className="card-panel p-5 rounded-xl space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                    User Click Telemetry
                  </h3>
                  <p className="text-[10px] text-slate-405 font-semibold mt-0.5 uppercase tracking-wider">
                    Anonymized click events containing element details and mouse coordinates.
                  </p>
                </div>
                <button
                  onClick={loadTabContent}
                  disabled={isDataLoading}
                  className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
                  title="Reload events"
                >
                  <RefreshCcw size={12} className={isDataLoading ? "animate-spin" : ""} />
                </button>
              </div>

              {isDataLoading ? (
                <div className="p-12 text-center text-xs text-slate-455 tracking-widest uppercase animate-pulse">
                  Retrieving click telemetry...
                </div>
              ) : auditLogs.filter((l) => l.eventType === "USER_CLICK").length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs uppercase tracking-wider">
                  No user clicks logged yet
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {auditLogs
                    .filter((l) => l.eventType === "USER_CLICK")
                    .map((log) => {
                      const findLoginIpForUser = (email: string) => {
                        const loginLog = auditLogs.find((l) => l.email === email && l.eventType === "LOGIN");
                        return loginLog ? loginLog.ip : "No login session IP found";
                      };

                      return (
                        <div
                          key={log.id}
                          className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3 text-xs leading-normal hover:border-slate-350 transition-all shadow-sm"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-2 gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded tracking-wider bg-blue/5 text-blue border border-blue/10">
                                Click Event
                              </span>
                              <span className="font-bold text-slate-750 font-mono">{log.email}</span>
                              
                              <button
                                onClick={() => {
                                  const ipVal = findLoginIpForUser(log.email);
                                  if (typeof window !== "undefined" && (window as any).showSystemAlert) {
                                    (window as any).showSystemAlert(`Login IP Session link for ${log.email}: ${ipVal}`, "info");
                                  } else {
                                    alert(`Login IP Session link for ${log.email}: ${ipVal}`);
                                  }
                                }}
                                className="text-[9px] font-bold text-blue hover:text-sky-700 bg-white border border-slate-250 px-2 py-0.5 rounded transition-colors shadow-sm ml-1 uppercase cursor-pointer"
                                title="Click to trace the user's IP from their login event"
                              >
                                Link Login IP
                              </button>
                            </div>

                            <span className="text-[10px] text-slate-455 font-mono">
                              {new Date(log.timestamp).toLocaleString()}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] text-slate-555">
                            <div className="space-y-0.5">
                              <span className="block font-bold text-[9px] text-slate-400 uppercase tracking-wide">Target Element</span>
                              <span className="font-mono text-slate-800 font-semibold">{log.metadata?.element || "—"}</span>
                            </div>

                            <div className="space-y-0.5">
                              <span className="block font-bold text-[9px] text-slate-400 uppercase tracking-wide">Coordinates (X / Y)</span>
                              <span>Viewport: <span className="font-mono font-semibold text-slate-700">X: {log.metadata?.clientX || 0}px, Y: {log.metadata?.clientY || 0}px</span></span>
                              <span className="block">Screen: <span className="font-mono text-slate-600">X: {log.metadata?.screenX || 0}px, Y: {log.metadata?.screenY || 0}px</span></span>
                            </div>

                            <div className="space-y-0.5">
                              <span className="block font-bold text-[9px] text-slate-400 uppercase tracking-wide">Details & Path</span>
                              <span className="block truncate" title={log.metadata?.text}>Label: <span className="font-bold text-slate-700">"{log.metadata?.text || "—"}"</span></span>
                              <span className="block font-mono">Route: <span className="text-slate-650 font-semibold">{log.metadata?.pagePath || "—"}</span></span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* 💾 Tab 4: Database logs deletion and editing */}
          {activeTab === "database" && (
            <div className="card-panel rounded-xl p-5 space-y-4 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <HardDrive size={14} className="text-blue" /> Database Records Management
                </h3>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={exportWholeDatabaseToExcel}
                    disabled={dbLogs.length === 0}
                    className="bg-blue hover:bg-sky-700 text-white font-bold uppercase text-[9px] tracking-wider px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-sm transition-colors cursor-pointer disabled:bg-blue/50"
                    title="Download the entire logs database as an Excel file"
                  >
                    <span>Backup Database (XLS)</span>
                  </button>

                  <button
                    onClick={loadTabContent}
                    disabled={isDataLoading}
                    className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-405 hover:text-slate-700 cursor-pointer"
                    title="Reload data"
                  >
                    <RefreshCcw size={12} className={isDataLoading ? "animate-spin" : ""} />
                  </button>
                </div>
              </div>

              {isDataLoading ? (
                <div className="p-12 text-center text-xs text-slate-455 animate-pulse tracking-widest uppercase">
                  Retrieving logs...
                </div>
              ) : dbLogs.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs uppercase tracking-wider">
                  No yard entries found
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto pr-1 bg-white border border-slate-150 rounded-lg px-2 shadow-sm">
                  {dbLogs.map((log) => (
                    <div key={log.gp_no} className="py-3 flex items-center justify-between hover:bg-slate-50 px-2 rounded-lg transition-colors">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-slate-800">{log.truck_no}</span>
                          <span className="text-[10px] font-mono text-blue bg-blue/5 border border-blue/10 px-2 py-0.5 rounded font-bold">
                            {log.gp_no}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-550">
                          Vessel: {log.vessel_name || "—"} | Location: {log.yard_location || "—"} | Surveyor: {log.surveyor_name || "—"}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditClick(log)}
                          className="p-1.5 border border-blue/20 text-blue hover:bg-blue hover:text-white rounded-lg transition-colors cursor-pointer"
                          title="Edit log details"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteLogEntry(log.gp_no)}
                          className="p-1.5 text-red-500 hover:text-red-650 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete log permanently"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 📬 Tab: Corporate Email Logs and SMTP Diagnostic Relay */}
          {activeTab === "emails" && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* Statistics Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card-panel p-4 rounded-xl space-y-1.5 shadow-sm">
                  <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none">
                    Total Dispatched
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-black text-slate-800">{totalSent}</span>
                    <Mail className="text-slate-400" size={18} />
                  </div>
                </div>

                <div className="card-panel p-4 rounded-xl space-y-1.5 shadow-sm">
                  <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none">
                    Opened Emails
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-black text-slate-800">{openedLogs.length}</span>
                    <Eye className="text-slate-400" size={18} />
                  </div>
                </div>

                <div className="card-panel p-4 rounded-xl space-y-1.5 shadow-sm">
                  <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none">
                    Open Engagement
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-black text-slate-800">{openRate}%</span>
                    <span className="text-[10px] text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded font-bold">
                      {totalOpens} Opens
                    </span>
                  </div>
                </div>

                <div className="card-panel p-4 rounded-xl space-y-1.5 shadow-sm">
                  <span className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none">
                    Proxy / VPN Detections
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-black text-slate-800">{proxyOpens}</span>
                    <Shield size={18} className="text-amber-500" />
                  </div>
                </div>
              </div>

              {/* Main Content Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left Column: Logs database list */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="card-panel p-5 rounded-xl space-y-4 shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Email Auditing Database
                      </h3>
                      <button
                        onClick={loadTabContent}
                        disabled={isDataLoading}
                        className="text-[10px] text-slate-400 hover:text-slate-800 font-bold uppercase flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                      >
                        <RefreshCcw size={12} className={isDataLoading ? "animate-spin" : ""} />
                        <span>Refresh Logs</span>
                      </button>
                    </div>

                    {/* Dynamic search & filtering bar */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                          <Search size={13} />
                        </span>
                        <input
                          type="text"
                          placeholder="Search address..."
                          value={emailSearchQuery}
                          onChange={(e) => setEmailSearchQuery(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue placeholder-slate-400"
                        />
                      </div>

                      <select
                        value={emailStatusFilter}
                        onChange={(e) => setEmailStatusFilter(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue cursor-pointer"
                      >
                        <option value="ALL">All Statuses</option>
                        <option value="SENT">Sent (Unopened)</option>
                        <option value="OPENED">Opened (Tracked)</option>
                      </select>

                      <select
                        value={emailTypeFilter}
                        onChange={(e) => setEmailTypeFilter(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue cursor-pointer"
                      >
                        <option value="ALL">All Event Types</option>
                        <option value="SECURITY_ALERT">Privileged Login Alerts</option>
                        <option value="AUDIT_ALERT">Audit Log Deletions</option>
                        <option value="SECURITY_WARNING">Rate Limits Warning</option>
                        <option value="PASSWORD_RESET">Password Recovery</option>
                      </select>
                    </div>

                    {/* Table View */}
                    {isDataLoading ? (
                      <div className="p-12 text-center text-xs text-slate-400 font-bold uppercase tracking-widest animate-pulse">
                        Synchronizing tracking database...
                      </div>
                    ) : filteredEmailLogs.length === 0 ? (
                      <div className="p-12 text-center text-slate-400 text-xs font-bold uppercase tracking-wider">
                        No email tracking logs found
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-sm">
                        <table className="min-w-full divide-y divide-slate-100 text-left">
                          <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            <tr>
                              <th className="px-4 py-3">Recipient Address</th>
                              <th className="px-4 py-3">Type</th>
                              <th className="px-4 py-3">Dispatched At</th>
                              <th className="px-4 py-3">Status</th>
                              <th className="px-4 py-3"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                            {filteredEmailLogs.map((log) => (
                              <React.Fragment key={log.id}>
                                <tr className="hover:bg-slate-50/50 transition-colors">
                                  <td className="px-4 py-3 font-mono font-bold text-slate-800 truncate max-w-[150px]" title={log.to}>
                                    {log.to}
                                  </td>
                                  <td className="px-4 py-3 font-bold">
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${
                                      log.type === "SECURITY_ALERT"
                                        ? "bg-blue/5 text-blue border border-blue/10"
                                        : log.type === "AUDIT_ALERT"
                                        ? "bg-red-50 text-red-700 border border-red-100"
                                        : log.type === "SECURITY_WARNING"
                                        ? "bg-amber-50 text-amber-700 border border-amber-100"
                                        : "bg-slate-100 text-slate-700"
                                    }`}>
                                      {log.type.replace("_", " ")}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-slate-500 font-mono text-[10px]">
                                    {new Date(log.sentAt).toLocaleTimeString()} {new Date(log.sentAt).toLocaleDateString()}
                                  </td>
                                  <td className="px-4 py-3 font-bold">
                                    {log.status === "OPENED" ? (
                                      <span className="flex items-center gap-1 text-teal-600 font-black">
                                        <CheckCircle size={12} /> OPENED ({log.opens?.length || 0})
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 font-semibold">SENT</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <button
                                      onClick={() => setExpandedEmailLogId(expandedEmailLogId === log.id ? null : log.id)}
                                      className="px-2 py-1 text-[10px] font-bold uppercase border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-700 rounded transition-colors cursor-pointer"
                                    >
                                      {expandedEmailLogId === log.id ? "Close" : "Inspect"}
                                    </button>
                                  </td>
                                </tr>

                                {/* Expanded tracking logs display */}
                                {expandedEmailLogId === log.id && (
                                  <tr className="bg-slate-50/50">
                                    <td colSpan={5} className="px-4 py-3.5 border-t border-slate-100">
                                      <div className="space-y-3.5">
                                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                          <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                            <Send size={12} className="text-blue" /> SMTP Transmission Details
                                          </h4>
                                          <span className="text-[9px] font-mono text-slate-400">ID: {log.id}</span>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px]">
                                          <div className="space-y-1">
                                            <span className="block font-bold text-[9px] text-slate-400 uppercase tracking-wide">Email Subject Line</span>
                                            <span className="font-semibold text-slate-800 font-sans">{log.subject}</span>
                                          </div>
                                          <div className="space-y-1">
                                            <span className="block font-bold text-[9px] text-slate-400 uppercase tracking-wide">Tracking Pixel Status</span>
                                            <span>
                                              {log.status === "OPENED" 
                                                ? `Distinct engagement captured at ${new Date(log.opens[0].timestamp).toLocaleString()}` 
                                                : "No pixel resolution events received yet."
                                              }
                                            </span>
                                          </div>
                                        </div>

                                        {/* Activity Log list */}
                                        {log.opens && log.opens.length > 0 && (
                                          <div className="space-y-2 border-t border-slate-100 pt-3">
                                            <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">
                                              🔍 Tracking Pixel Activity Logs:
                                            </span>
                                            <div className="max-h-36 overflow-y-auto space-y-2">
                                              {log.opens.map((op: any, oIndex: number) => (
                                                <div key={oIndex} className="text-[10px] font-semibold text-slate-500 font-mono flex flex-col sm:flex-row sm:items-start sm:justify-between border-b border-slate-100 pb-2 gap-2">
                                                  <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-teal-650 font-bold">● Open #{oIndex + 1}</span>
                                                    <span className="text-slate-650">{new Date(op.timestamp).toLocaleString()}</span>
                                                    <span className="bg-slate-200/60 text-slate-600 px-1.5 py-0.2 rounded text-[9px]">IP: {op.ip}</span>
                                                    {op.clientName && (
                                                      <span className={`px-1.5 py-0.2 rounded text-[9px] ${op.isProxy ? "bg-amber-100 text-amber-800 font-black border border-amber-200" : "bg-blue/5 text-blue border border-blue/10"}`}>
                                                        {op.clientName}
                                                      </span>
                                                    )}
                                                    {op.os && (
                                                      <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded text-[9px] font-bold">
                                                        💻 {op.device || "Desktop"} ({op.os})
                                                      </span>
                                                    )}
                                                  </div>
                                                  
                                                  {op.country && (
                                                    <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                                      <span>📍 Location:</span>
                                                      <span className="text-slate-600 font-black">{op.city || "Unknown"}, {op.region || ""}, {op.country}</span>
                                                      <span className="text-slate-300 font-normal">|</span>
                                                      <span>ISP:</span>
                                                      <span className="text-slate-600 font-black truncate max-w-[120px]" title={op.isp}>{op.isp}</span>
                                                    </div>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: SMTP Diagnostic Verification Form */}
                <div className="lg:col-span-1 space-y-4">
                  <div className="card-panel p-5 rounded-xl space-y-4 shadow-sm">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                      <Mail size={16} className="text-blue" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        SMTP Mail Diagnostic
                      </h3>
                    </div>

                    <form onSubmit={handleSendTestEmail} className="space-y-4">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Diagnostic Recipient Address
                        </label>
                        <input
                          type="email"
                          required
                          placeholder="developer@masmarine.com"
                          value={testEmailTarget}
                          onChange={(e) => setTestEmailTarget(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-xs focus:outline-none focus:border-blue transition-colors font-semibold"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Alert Event Type Preview
                        </label>
                        <input
                          type="text"
                          readOnly
                          value="SMTP Diagnostic: PASSWORD_RESET alert test"
                          className="w-full bg-slate-100 border border-slate-200 text-slate-500 rounded-lg px-3 py-2 text-xs focus:outline-none cursor-not-allowed font-semibold"
                        />
                      </div>

                      <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                        ⚠️ **Notice**: Submitting this form dispatches a standard password reset notification alert. Opening the link will register tracking logs in the panel above.
                      </p>

                      <button
                        type="submit"
                        disabled={isTestSending}
                        className="w-full bg-blue hover:bg-sky-750 text-white font-bold uppercase text-xs tracking-wider py-2.5 rounded-lg transition-colors btn-touch cursor-pointer disabled:bg-blue/50"
                      >
                        {isTestSending ? "Sending Alert..." : "Dispatch Test Alert"}
                      </button>
                    </form>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* ⚙️ Tab 6: System Controls (Maintenance & Announcement broadcast) */}
          {activeTab === "system" && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* Maintenance mode configuration card */}
              <div className="card-panel p-5 rounded-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                      Maintenance Mode Lockout
                    </h3>
                    <p className="text-[10px] text-slate-405 font-semibold mt-0.5 uppercase tracking-wider">
                      Temporarily lock out normal staff and surveyors from performing operations.
                    </p>
                  </div>
                  
                  <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded border uppercase tracking-wider ${
                    maintMode 
                      ? "bg-red-50 text-red-600 border-red-200 animate-pulse" 
                      : "bg-teal-50 text-teal-700 border-teal-200"
                  }`}>
                    {maintMode ? "Active Lock" : "Operational"}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                  <div className="text-[11px] text-slate-555 leading-relaxed font-semibold max-w-md">
                    {maintMode ? (
                      <span className="text-red-600 font-bold">
                        ⚠️ WARNING: Maintenance mode is currently enabled. All surveyors and normal users are blocked from loading their forms or submitting logs. Only administrators and developers can access the system.
                      </span>
                    ) : (
                      <span>
                        System is fully active. Turn on maintenance mode to perform backend updates or lock data entries during scheduled port outages.
                      </span>
                    )}
                  </div>

                  <button
                    onClick={handleToggleMaintenance}
                    disabled={isSystemUpdating}
                    className={`px-5 py-2.5 font-bold uppercase text-[10px] tracking-wider rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50 shrink-0 ${
                      maintMode
                        ? "bg-teal-600 hover:bg-teal-700 text-white"
                        : "bg-red-600 hover:bg-red-700 text-white"
                    }`}
                  >
                    {maintMode ? "Deactivate Maintenance" : "Activate Maintenance"}
                  </button>
                </div>
              </div>

              {/* 📊 Daily Report & Database Backup Trigger Card */}
              <div className="card-panel p-5 rounded-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                      Daily Report & Database Backup Mailer
                    </h3>
                    <p className="text-[10px] text-slate-405 font-semibold mt-0.5 uppercase tracking-wider">
                      Manually trigger a complete Excel XLS database backup and activity statistics report to the administrator's email.
                    </p>
                  </div>
                  
                  <span className="text-[9px] font-bold px-2.5 py-0.5 rounded border bg-blue/5 text-blue border-blue/20 uppercase tracking-wider">
                    Auto-Scheduler Ready
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                  <div className="text-[11px] text-slate-555 leading-relaxed font-semibold max-w-md">
                    <span>
                      Triggering this action compiles all active yard logs, generates an activity summary over the last 24 hours (total logs, active vessels, and active staff counts), and emails a secure spreadsheet attachment backup directly to your registered administrator address.
                    </span>
                  </div>

                  <button
                    onClick={handleSendReport}
                    disabled={isSendingReport}
                    className="bg-blue hover:bg-sky-700 text-white font-bold uppercase text-[10px] tracking-wider px-5 py-2.5 rounded-lg shadow-sm transition-colors cursor-pointer disabled:bg-blue/50 shrink-0"
                  >
                    {isSendingReport ? "Compiling & Sending..." : "Send Backup Report Now"}
                  </button>
                </div>
              </div>

              {/* System Announcements broadcast publisher card */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Publish announcement form */}
                <div className="lg:col-span-1 card-panel p-5 rounded-xl space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2">
                    Create Screen-Lock Alert
                  </h3>

                  <form onSubmit={handlePublishNotification} className="space-y-3.5">
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500">
                        Alert Title
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Mandatory Port Server Downtime"
                        value={newNotifTitle}
                        onChange={(e) => setNewNotifTitle(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500">
                        Announcement message
                      </label>
                      <textarea
                        required
                        rows={4}
                        placeholder="Please synchronize all locally queued entries before 5:00 PM."
                        value={newNotifMessage}
                        onChange={(e) => setNewNotifMessage(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue font-semibold"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSystemUpdating}
                      className="w-full bg-blue text-white font-bold uppercase text-[10px] tracking-wider py-2.5 rounded-lg hover:bg-sky-700 transition-colors cursor-pointer disabled:bg-blue/50"
                    >
                      Broadcast Alert (Lock Screen)
                    </button>
                  </form>
                </div>

                {/* Display active announcement status and readers */}
                <div className="lg:col-span-2 card-panel p-5 rounded-xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Active Announcement & Reads Status
                    </h3>

                    {systemNotif && (
                      <button
                        onClick={handleClearNotification}
                        disabled={isSystemUpdating}
                        className="text-[9px] font-bold text-red-600 hover:text-red-750 bg-red-50 border border-red-100 px-2 py-0.5 rounded uppercase tracking-wider cursor-pointer disabled:opacity-50"
                      >
                        Deactivate Alert
                      </button>
                    )}
                  </div>

                  {!systemNotif ? (
                    <div className="h-44 flex items-center justify-center text-slate-450 text-xs uppercase tracking-wider font-semibold">
                      No active system alert broadcasted
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-4 bg-red-50/50 border border-red-100 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase text-red-655 tracking-wider">
                            Active Broadcast System Alert
                          </span>
                          <span className="text-[9px] text-slate-405 font-mono">
                            Created: {new Date(systemNotif.createdAt || Date.now()).toLocaleString()}
                          </span>
                        </div>
                        <h4 className="text-xs font-black text-slate-800 uppercase">{systemNotif.title}</h4>
                        <p className="text-xs text-slate-650 leading-relaxed whitespace-pre-line font-medium">{systemNotif.message}</p>
                      </div>

                      {/* Readers lists */}
                      <div className="space-y-2">
                        <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-555">
                          Acknowledge / Read confirmation list ({systemNotif.readBy?.length || 0} Users)
                        </span>

                        {!systemNotif.readBy || systemNotif.readBy.length === 0 ? (
                          <div className="p-4 text-center text-[10px] text-slate-450 border border-dashed border-slate-200 rounded-lg uppercase tracking-wider font-bold">
                            No user read confirmations received yet
                          </div>
                        ) : (
                          <div className="max-h-28 overflow-y-auto border border-slate-100 rounded-lg p-2 divide-y divide-slate-50 bg-slate-50/50">
                            {systemNotif.readBy.map((readerEmail: string) => (
                              <div key={readerEmail} className="py-1 text-[11px] font-mono text-slate-650 flex items-center gap-1.5">
                                <span className="text-teal-600">✓</span>
                                <span>{readerEmail}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

              </div>

              {/* 📧 System Broadcasts & Email Open Tracking Audit */}
              <div className="card-panel p-5 rounded-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                      📧 System Broadcasts & Email Open Tracking Audit
                    </h3>
                    <p className="text-[10px] text-slate-405 font-semibold mt-0.5 uppercase tracking-wider">
                      Audit real-time open status, read receipts, and tracking pixel statistics for system-dispatched notifications.
                    </p>
                  </div>
                  <span className="text-[9px] font-bold px-2.5 py-0.5 rounded border bg-blue/5 text-blue border-blue/20 uppercase tracking-wider">
                    Pixel Tracker Active
                  </span>
                </div>

                {emailLogs.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-450 border border-dashed border-slate-200 rounded-lg font-bold uppercase tracking-wider">
                    No dispatched email tracking logs found in database
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-100 rounded-lg">
                    <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                      <thead className="bg-slate-50 font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="p-3">Sent To</th>
                          <th className="p-3">Subject / Purpose</th>
                          <th className="p-3">Sent Time</th>
                          <th className="p-3 text-center">Status</th>
                          <th className="p-3 text-center">Opens</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                        {emailLogs.map((log) => (
                          <React.Fragment key={log.id}>
                            <tr className="hover:bg-slate-50/50">
                              <td className="p-3 font-semibold text-slate-800 font-mono text-[11px]">{log.to}</td>
                              <td className="p-3 font-semibold">{log.subject}</td>
                              <td className="p-3 text-slate-500 text-[10px]">{log.sentAt ? new Date(log.sentAt).toLocaleString() : "N/A"}</td>
                              <td className="p-3 text-center">
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                                  log.status === "OPENED"
                                    ? "bg-teal-50 text-teal-700 border-teal-200"
                                    : "bg-slate-50 text-slate-450 border-slate-200"
                                }`}>
                                  {log.status}
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                <span className="font-bold text-slate-850 bg-slate-100 px-2 py-0.5 rounded-full text-[11px]">{log.opens?.length || 0}</span>
                              </td>
                            </tr>
                            {log.opens && log.opens.length > 0 && (
                              <tr className="bg-slate-50/20">
                                <td colSpan={5} className="p-3 border-t-0">
                                  <div className="space-y-1.5 pl-6 pb-2">
                                    <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">
                                      🔍 Tracking Pixel Activity Logs:
                                    </span>
                                    <div className="max-h-36 overflow-y-auto space-y-1.5">
                                      {log.opens.map((op: any, oIndex: number) => (
                                        <div key={oIndex} className="text-[10px] font-semibold text-slate-500 font-mono flex flex-col sm:flex-row sm:items-start sm:justify-between border-b border-slate-100/50 pb-1 gap-2">
                                          <div className="flex flex-wrap items-center gap-1.5">
                                            <span className="text-teal-600 font-bold">● Open #{oIndex + 1}</span>
                                            <span className="text-slate-650">{new Date(op.timestamp).toLocaleString()}</span>
                                            <span className="bg-slate-200/60 text-slate-600 px-1.5 py-0.2 rounded text-[9px]">IP: {op.ip}</span>
                                            {op.clientName && (
                                              <span className={`px-1.5 py-0.2 rounded text-[9px] ${op.isProxy ? "bg-amber-100 text-amber-800" : "bg-blue/5 text-blue"}`}>
                                                {op.clientName}
                                              </span>
                                            )}
                                            {op.os && (
                                              <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded text-[9px] font-bold">
                                                💻 {op.device || "Desktop"} ({op.os})
                                              </span>
                                            )}
                                          </div>
                                          
                                          {op.country && (
                                            <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                              <span>📍 Location:</span>
                                              <span className="text-slate-600 font-black">{op.city || "Unknown"}, {op.region || ""}, {op.country}</span>
                                              <span className="text-slate-355 font-normal">|</span>
                                              <span>ISP:</span>
                                              <span className="text-slate-600 font-black truncate max-w-[120px]" title={op.isp}>{op.isp}</span>
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </div>

      {/* Developer Edit Log Modal Overlay */}
      {editingLog && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Edit2 size={14} className="text-blue" /> Edit Database Entry
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
                  {isUpdating ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
