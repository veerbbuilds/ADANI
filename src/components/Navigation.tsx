"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { WifiOff, RefreshCcw, FileText, BarChart3, ShieldAlert, User, LogOut, ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle, Database, Lock, Mail } from "lucide-react";
import { TelemetryEngine } from "@/lib/telemetry";

interface UserSession {
  email: string;
  role: string;
  uid: string;
}

interface PermissionConfig {
  access_log_entry: boolean;
  access_dashboard: boolean;
  delete_logs: boolean;
  export_csv: boolean;
}

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [queueCount, setQueueCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  
  // Session & Dynamic Permissions Matrix states
  const [session, setSession] = useState<UserSession | null>(null);
  const [permissions, setPermissions] = useState<Record<string, PermissionConfig> | null>(null);
  const [impersonatedRole, setImpersonatedRole] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  // Custom UI Dialog Popups
  const [systemAlert, setSystemAlert] = useState<{ message: string; type: "success" | "error" | "info"; visible: boolean } | null>(null);
  const [systemConfirm, setSystemConfirm] = useState<{ message: string; onConfirm: () => void; visible: boolean } | null>(null);

  // Maintenance & System broadcast notifications states
  const [maintenanceActive, setMaintenanceActive] = useState<boolean>(false);
  const [activeNotif, setActiveNotif] = useState<any | null>(null);

  // Skip rendering sidebar/columns entirely on login and other public viewports
  const isPublicPage = pathname === "/login" || pathname === "/forgot-password" || pathname === "/~offline";

  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsOnline(navigator.onLine);

    // Bind custom UI Popups globally
    (window as any).showSystemAlert = (message: string, type: "success" | "error" | "info" = "info") => {
      setSystemAlert({ message, type, visible: true });
    };

    (window as any).showSystemConfirm = (message: string, onConfirm: () => void) => {
      setSystemConfirm({ message, onConfirm, visible: true });
    };

    const savedImpersonation = localStorage.getItem("dev_impersonated_role");
    if (savedImpersonation) {
      setImpersonatedRole(savedImpersonation);
    }

    const savedCollapse = localStorage.getItem("dev_sidebar_collapsed") === "true";
    setIsCollapsed(savedCollapse);

    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Fetch dynamic permissions matrix and active session
    const loadPermissionsAndSession = async () => {
      try {
        const [sessionRes, permRes] = await Promise.all([
          fetch("/api/auth/session"),
          fetch("/api/developer/permissions"),
        ]);

        if (sessionRes.ok) {
          const sessionData = await sessionRes.json();
          if (sessionData.authenticated) {
            setSession(sessionData.user);
          }
        }

        if (permRes.ok) {
          const permData = await permRes.json();
          setPermissions(permData);
        }
      } catch (err) {
        console.error("Failed to load authorization states:", err);
      }
    };

    loadPermissionsAndSession();

    // Check queue size
    const checkQueue = () => {
      try {
        const queueRaw = localStorage.getItem("offline_logs_queue");
        setQueueCount(queueRaw ? JSON.parse(queueRaw).length : 0);
      } catch (err) {
        setQueueCount(0);
      }
    };

    checkQueue();
    const interval = setInterval(checkQueue, 5000); // 🔒 HARDENED: Reduced from 2s to 5s (CWE-400)
    window.addEventListener("queue-updated", checkQueue);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("queue-updated", checkQueue);
      clearInterval(interval);
    };
  }, []);

  // Update layout padding dynamically using global CSS variable values
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (isPublicPage) {
      document.documentElement.style.setProperty("--sidebar-width", "0px");
    } else {
      document.documentElement.style.setProperty("--sidebar-width", isCollapsed ? "80px" : "256px");
    }
  }, [isCollapsed, isPublicPage]);

  // ⚙️ Query Maintenance status & active blocking alert announcements
  useEffect(() => {
    if (isPublicPage) return;

    const queryStatus = async () => {
      try {
        const res = await fetch("/api/system/config");
        if (res.ok) {
          const data = await res.json();
          const role = impersonatedRole || session?.role;
          const bypass = role === "superadmin" || role === "admin";
          
          setMaintenanceActive(!!data.maintenanceMode && !bypass);
          if (data.notification && !data.notification.isRead) {
            setActiveNotif(data.notification);
          } else {
            setActiveNotif(null);
          }
        }
      } catch (e) {
        console.error("Failed checking maintenance/alert configs:", e);
      }
    };

    queryStatus();
    const timer = setInterval(queryStatus, 30000); // 🔒 HARDENED: Reduced from 8s to 30s (CWE-400)
    return () => clearInterval(timer);
  }, [pathname, isPublicPage, session, impersonatedRole]);

  const handleMarkNotifRead = async () => {
    if (!activeNotif) return;
    try {
      const res = await fetch("/api/system/notification/read", { method: "POST" });
      if (res.ok) {
        setActiveNotif(null);
        if (typeof window !== "undefined" && (window as any).showSystemAlert) {
          (window as any).showSystemAlert("System announcement marked as read.", "success");
        }
      }
    } catch (e) {
      console.error("Failed acknowledging system alert:", e);
    }
  };

  // 🖱️ Capture global click events telemetry (post-login events have NO IP address directly stored)
  useEffect(() => {
    if (typeof window === "undefined" || !session?.email) return;

    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Filter out clicking scrollbars or outer blank areas to avoid spamming
      if (target === document.documentElement || target === document.body) return;

      const elementTag = target.tagName.toLowerCase();
      const elementId = target.id ? `#${target.id}` : "";
      
      // Get first class name if any
      const elementClass = target.className && typeof target.className === "string" && target.className.trim()
        ? `.${target.className.trim().split(/\s+/)[0]}`
        : "";

      const elementDesc = `${elementTag}${elementId}${elementClass}`;
      const textContent = target.textContent?.trim().substring(0, 40) || "";
      
      TelemetryEngine.dispatchEvent({
        eventType: "USER_CLICK",
        email: session.email,
        metadata: {
          element: elementDesc,
          text: textContent,
          clientX: e.clientX,
          clientY: e.clientY,
          screenX: e.screenX,
          screenY: e.screenY,
          pagePath: window.location.pathname,
        },
      });
    };

    document.addEventListener("click", handleGlobalClick);
    return () => {
      document.removeEventListener("click", handleGlobalClick);
    };
  }, [session]);

  if (isPublicPage) return null;

  if (maintenanceActive) {
    return (
      <div className="fixed inset-0 bg-slate-900 z-[9999] flex flex-col items-center justify-center p-6 text-center select-none text-white space-y-4">
        <div className="h-16 w-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center text-3xl border border-amber-500/20 animate-pulse">
          ⚙️
        </div>
        <h1 className="text-lg font-black uppercase tracking-wider text-slate-100">System Under Maintenance</h1>
        <p className="text-xs text-slate-405 max-w-sm leading-relaxed font-semibold">
          SaaS Port Logistics is currently undergoing scheduled backend optimizations. Please contact the logistics desk or try again shortly.
        </p>
      </div>
    );
  }

  const triggerSync = async () => {
    try {
      const queueRaw = localStorage.getItem("offline_logs_queue");
      if (!queueRaw) return;

      const queue = JSON.parse(queueRaw);
      if (!Array.isArray(queue) || queue.length === 0) return;

      setIsSyncing(true);

      // 🔒 HARDENED: Cap queue to prevent localStorage exhaustion (CWE-400)
      const MAX_OFFLINE_QUEUE = 50;
      const trimmedQueue = queue.slice(0, MAX_OFFLINE_QUEUE);

      // 🔒 FIX: Track success count and splice after loop (prevents shift() desync)
      let successCount = 0;
      for (const entry of trimmedQueue) {
        try {
          const res = await fetch("/api/log-movement", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(entry),
          });

          if (res.ok || res.status === 409) {
            successCount++;
          } else {
            break;
          }
        } catch {
          break;
        }
      }

      // Remove all successfully synced entries at once
      trimmedQueue.splice(0, successCount);
      localStorage.setItem("offline_logs_queue", JSON.stringify(trimmedQueue));
      window.dispatchEvent(new Event("queue-updated"));
    } catch (error) {
      console.error("Auto-sync failed:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogout = async () => {
    (window as any).showSystemConfirm("Are you sure you want to log out of the system?", async () => {
      try {
        const res = await fetch("/api/auth/logout", { method: "POST" });
        if (res.ok) {
          localStorage.removeItem("dev_impersonated_role");
          router.push("/login");
          router.refresh();
        }
      } catch (err) {
        console.error("Logout failed:", err);
      }
    });
  };

  const handleImpersonateChange = (roleVal: string) => {
    if (roleVal === "superadmin") {
      localStorage.removeItem("dev_impersonated_role");
      setImpersonatedRole(null);
    } else {
      localStorage.setItem("dev_impersonated_role", roleVal);
      setImpersonatedRole(roleVal);
    }
    window.location.reload();
  };

  const toggleCollapse = () => {
    const nextCollapsed = !isCollapsed;
    setIsCollapsed(nextCollapsed);
    localStorage.setItem("dev_sidebar_collapsed", String(nextCollapsed));
  };

  // Determine dynamic link visibilities based on preview/actual role
  const isActualDeveloper = session?.role === "superadmin";
  const activeRole = isActualDeveloper && impersonatedRole ? impersonatedRole : (session?.role || "surveyor");
  const rolePermissions = permissions?.[activeRole];

  const showLogEntry = rolePermissions ? rolePermissions.access_log_entry : (activeRole === "surveyor" || activeRole === "admin" || activeRole === "superadmin");
  const showDashboard = rolePermissions ? rolePermissions.access_dashboard : (activeRole === "admin" || activeRole === "superadmin");
  const showDeveloper = activeRole === "superadmin";

  const links = [
    { href: "/surveyor", label: "Log Entry", icon: FileText, visible: showLogEntry },
    { href: "/surveyor/logs", label: "My Logs", icon: Database, visible: activeRole === "surveyor" },
    { href: "/dashboard", label: "Dashboard", icon: BarChart3, visible: showDashboard },
    { href: "/developer", label: "Developer", icon: ShieldAlert, visible: showDeveloper },
    { href: "/developer/emails", label: "Email Logs", icon: Mail, visible: showDeveloper },
    { href: "/profile", label: "Profile", icon: User, visible: true },
  ];

  return (
    <>
      {/* 📡 Connection Diagnostics Banner (Mobile top header status) */}
      {(!isOnline || (isOnline && queueCount > 0)) && (
        <div className="md:hidden fixed top-0 left-0 right-0 z-50 text-[10px] font-bold text-center w-full transition-all duration-300">
          {!isOnline ? (
            <div className="bg-amber-600 text-white py-1.5 flex items-center justify-between px-4">
              <span className="flex items-center gap-1"><WifiOff size={11} className="pulse-icon" /> Offline</span>
              <span>{queueCount} Pending</span>
            </div>
          ) : (
            <div className="bg-blue text-white py-1.5 flex items-center justify-between px-4">
              <span className="flex items-center gap-1"><RefreshCcw size={11} className={isSyncing ? "animate-spin" : ""} /> Sync Ready</span>
              {!isSyncing && (
                <button onClick={triggerSync} className="bg-white text-blue px-2 py-0.5 rounded text-[9px] font-black uppercase">
                  Sync
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 🎭 Mobile Role Impersonation Toolbar (Super Admin only) */}
      {isActualDeveloper && (
        <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-slate-800 text-white py-1 px-4 flex items-center justify-between text-[10px] font-bold border-b border-slate-700">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-ping"></span>
            ACTING AS: <span className="text-teal-300 uppercase">{activeRole}</span>
          </span>
          <select
            value={impersonatedRole || "superadmin"}
            onChange={(e) => handleImpersonateChange(e.target.value)}
            className="bg-slate-700 border-none rounded px-1.5 py-0.5 text-[9.5px] text-white font-bold cursor-pointer focus:outline-none"
          >
            <option value="superadmin">Dev (Actual)</option>
            <option value="admin">Admin Preview</option>
            <option value="surveyor">Surveyor Preview</option>
          </select>
        </div>
      )}

      {/* 📱 Mobile Android-style Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-border-light shadow-[0_-2px_10px_rgba(0,0,0,0.03)] px-3 py-1 flex items-center justify-around">
        {links
          .filter((l) => l.visible)
          .map((link) => {
            const IconComponent = link.icon;
            const isActive = pathname === link.href;

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
                  isActive ? "text-blue" : "text-slate-400 hover:text-slate-650"
                }`}
              >
                <IconComponent size={18} className={isActive ? "stroke-[2.5px]" : "stroke-[1.8px]"} />
                <span className="text-[9px] font-black uppercase tracking-wider">{link.label.split(" ")[0]}</span>
              </Link>
            );
          })}

        <button
          onClick={handleLogout}
          className="flex flex-col items-center gap-1 px-3 py-1.5 text-slate-450 hover:text-red-500 rounded-xl cursor-pointer"
        >
          <LogOut size={18} className="stroke-[1.8px]" />
          <span className="text-[9px] font-black uppercase tracking-wider">Exit</span>
        </button>
      </nav>

      {/* 🏢 Desktop Premium Collapsible Sidebar */}
      <aside className={`hidden md:flex fixed top-0 bottom-0 left-0 z-50 bg-white border-r border-border-light shadow-[4px_0_24px_rgba(0,0,0,0.02)] flex-col justify-between p-4 transition-all duration-200 ${isCollapsed ? "w-20" : "w-64"}`}>
        <div className="space-y-4">
          {/* Header branding */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 relative">
            <div className="flex items-center gap-2.5 overflow-hidden w-full">
              <img
                src="/icons/icon-192x192.png"
                alt="Logo"
                className="h-9 w-9 object-contain rounded-full border border-slate-200 shadow-sm shrink-0"
              />
              {!isCollapsed && (
                <div className="truncate animate-fadeIn">
                  <h2 className="text-xs font-black text-slate-800 uppercase tracking-wide leading-tight">
                    Mas Marine
                  </h2>
                  <span className="text-[9px] text-blue font-bold tracking-widest uppercase">
                    Adani Ports Logbook
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={toggleCollapse}
              className={`p-1 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-slate-700 cursor-pointer bg-white shadow-sm transition-transform hover:scale-105 ${isCollapsed ? "absolute -right-2 top-1.5" : ""}`}
              title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
            </button>
          </div>

          {/* 🎭 Role Impersonation Toolbar (Super Admin only) */}
          {isActualDeveloper && (
            <div className={`bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-1.5 ${isCollapsed ? "px-1 py-2 text-center" : ""}`}>
              {!isCollapsed ? (
                <>
                  <div className="flex items-center justify-between text-[8px] font-bold text-slate-450 uppercase tracking-widest leading-none">
                    <span>🎭 UI Role Impersonation</span>
                    {impersonatedRole && (
                      <span className="bg-teal-50 border border-teal-200 text-teal-655 px-1 py-0.5 rounded text-[7px] font-bold leading-none animate-pulse">
                        PREVIEW
                      </span>
                    )}
                  </div>
                  <select
                    value={impersonatedRole || "superadmin"}
                    onChange={(e) => handleImpersonateChange(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-[11px] font-bold text-slate-700 focus:outline-none focus:border-blue cursor-pointer"
                  >
                    <option value="superadmin">Developer (Actual)</option>
                    <option value="admin">Admin View</option>
                    <option value="surveyor">Surveyor View</option>
                  </select>
                </>
              ) : (
                <select
                  value={impersonatedRole || "superadmin"}
                  onChange={(e) => handleImpersonateChange(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded px-0.5 py-0.5 text-[9px] font-bold text-slate-700 focus:outline-none cursor-pointer text-center"
                  title="🎭 Impersonation Preview"
                >
                  <option value="superadmin">DEV</option>
                  <option value="admin">ADM</option>
                  <option value="surveyor">SVY</option>
                </select>
              )}
            </div>
          )}

          {/* Menu items */}
          <nav className="space-y-1">
            {links
              .filter((l) => l.visible)
              .map((link) => {
                const IconComponent = link.icon;
                const isActive = pathname === link.href;

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    title={isCollapsed ? link.label : ""}
                    className={`flex items-center rounded-xl transition-all duration-200 cursor-pointer ${
                      isCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5 text-xs font-bold uppercase tracking-wider"
                    } ${
                      isActive
                        ? "bg-blue text-white shadow-md shadow-blue/20"
                        : "text-slate-550 hover:text-slate-850 hover:bg-slate-55"
                    }`}
                  >
                    <IconComponent size={isCollapsed ? 18 : 15} className="shrink-0" />
                    {!isCollapsed && <span className="truncate">{link.label}</span>}
                  </Link>
                );
              })}
          </nav>
        </div>

        {/* Sidebar Footer detailing network, active user session & logout */}
        <div className="space-y-3 pt-3 border-t border-slate-100">
          {!isCollapsed && (
            <div className="text-[9px] text-center font-bold tracking-wider uppercase text-slate-400">
              System Version: <span className="text-slate-650 font-black">v1.1.1</span>
            </div>
          )}
          <div className="space-y-1">
            {!isOnline ? (
              <div className={`bg-amber-50 rounded-lg border border-amber-200 flex items-center justify-between text-[10px] text-amber-800 font-bold leading-normal ${isCollapsed ? "p-1.5 justify-center" : "p-2.5"}`} title="Offline Mode">
                <WifiOff size={12} className="pulse-icon shrink-0" />
                {!isCollapsed && (
                  <>
                    <span>Offline Mode</span>
                    {queueCount > 0 && <span className="bg-amber-200 px-1.5 py-0.5 rounded font-mono">{queueCount}</span>}
                  </>
                )}
              </div>
            ) : (
              isOnline && queueCount > 0 && (
                <div className={`bg-blue/5 rounded-lg border border-blue/10 flex items-center justify-between text-[10px] text-blue font-bold leading-normal ${isCollapsed ? "p-1.5 justify-center" : "p-2.5"}`} title="Sync Ready">
                  <RefreshCcw size={12} className={`shrink-0 ${isSyncing ? "animate-spin" : ""}`} />
                  {!isCollapsed && (
                    <>
                      <span>Sync Ready</span>
                      {!isSyncing && (
                        <button onClick={triggerSync} className="bg-blue text-white px-2 py-0.5 rounded text-[9px] font-black uppercase">
                          Sync
                        </button>
                      )}
                    </>
                  )}
                </div>
              )
            )}
          </div>

          {session && (
            <div className={`flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl ${isCollapsed ? "p-1.5 flex-col gap-2" : "p-2.5"}`}>
              <div className="flex items-center gap-2 overflow-hidden w-full justify-center">
                <div className="h-7 w-7 bg-blue/10 text-blue font-black rounded-full flex items-center justify-center text-xs uppercase shrink-0">
                  {session.email[0]}
                </div>
                {!isCollapsed && (
                  <div className="text-[10px] leading-tight overflow-hidden animate-fadeIn w-full">
                    <span className="font-bold text-slate-700 block truncate max-w-[110px]" title={session.email}>
                      {session.email}
                    </span>
                    <span className="text-slate-400 capitalize">{activeRole}</span>
                  </div>
                )}
              </div>

              <button
                onClick={handleLogout}
                className={`p-1.5 text-slate-450 hover:text-red-655 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0 ${isCollapsed ? "w-full flex justify-center" : ""}`}
                title="Log Out"
              >
                <LogOut size={14} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* 🔔 Premium System-Wide Alert Dialog Popup */}
      {systemAlert?.visible && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm p-6 shadow-xl space-y-4 text-center">
            <div className="flex justify-center">
              {systemAlert.type === "success" && (
                <div className="h-12 w-12 rounded-full bg-teal-50 border border-teal-200 text-teal-600 flex items-center justify-center">
                  <CheckCircle2 size={24} className="text-teal-650" />
                </div>
              )}
              {systemAlert.type === "error" && (
                <div className="h-12 w-12 rounded-full bg-red-50 border border-red-200 text-red-600 flex items-center justify-center">
                  <AlertTriangle size={24} />
                </div>
              )}
              {systemAlert.type === "info" && (
                <div className="h-12 w-12 rounded-full bg-blue/5 border border-blue/20 text-blue flex items-center justify-center">
                  <ShieldAlert size={24} />
                </div>
              )}
            </div>
            
            <div className="space-y-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                System Notification
              </h4>
              <p className="text-xs text-slate-700 font-semibold leading-relaxed">
                {systemAlert.message}
              </p>
            </div>

            <button
              onClick={() => setSystemAlert({ ...systemAlert, visible: false })}
              className="w-full py-2.5 bg-blue text-white rounded-lg text-xs font-black uppercase tracking-wider hover:bg-sky-700 transition-colors cursor-pointer"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* ❓ Premium System-Wide Confirm Dialog Popup */}
      {systemConfirm?.visible && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm p-6 shadow-xl space-y-4 text-center">
            <div className="flex justify-center">
              <div className="h-12 w-12 rounded-full bg-blue/5 border border-blue/20 text-blue flex items-center justify-center">
                <ShieldAlert size={24} />
              </div>
            </div>
            
            <div className="space-y-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Action Required
              </h4>
              <p className="text-xs text-slate-700 font-semibold leading-relaxed">
                {systemConfirm.message}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSystemConfirm({ ...systemConfirm, visible: false })}
                className="flex-1 py-2.5 border border-slate-200 text-slate-500 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setSystemConfirm({ ...systemConfirm, visible: false });
                  systemConfirm.onConfirm();
                }}
                className="flex-1 py-2.5 bg-blue text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-sky-700 transition-colors cursor-pointer"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 📢 Screen-Locking System Announcement Modal Overlay */}
      {activeNotif && (
        <div className="fixed inset-0 bg-slate-950/80 z-[9998] flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3 text-red-600 font-bold text-xs uppercase tracking-wider">
              <span className="animate-bounce">📢</span> System Announcement
            </div>
            <div className="space-y-2 text-left">
              <h4 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                {activeNotif.title}
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed font-semibold whitespace-pre-line">
                {activeNotif.message}
              </p>
            </div>
            <div className="pt-2">
              <button
                onClick={handleMarkNotifRead}
                className="w-full bg-red-600 hover:bg-red-750 text-white font-bold uppercase text-xs tracking-wider py-3 rounded-lg transition-colors cursor-pointer shadow-lg shadow-red-600/20"
              >
                I Acknowledge & Accept
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
