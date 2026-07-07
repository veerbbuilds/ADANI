"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

/**
 * Global Error Handler — catches root layout crashes
 * This is the last line of defense — must be self-contained (no layout dependencies).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", backgroundColor: "#f8fafc" }}>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "24px" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>⚠️</div>
          <h1 style={{ fontSize: "18px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "1px", color: "#1e293b", marginBottom: "8px" }}>
            Critical System Error
          </h1>
          <p style={{ fontSize: "12px", color: "#64748b", maxWidth: "400px", lineHeight: 1.6, marginBottom: "24px" }}>
            The Adani Port Logistics application encountered a critical error and could not recover. 
            Please try refreshing the page. If the issue persists, contact the logistics desk.
          </p>
          {error.digest && (
            <p style={{ fontSize: "10px", color: "#94a3b8", fontFamily: "monospace", marginBottom: "16px" }}>
              Error Reference: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              backgroundColor: "#0284c7",
              color: "#ffffff",
              fontWeight: "bold",
              textTransform: "uppercase",
              fontSize: "12px",
              letterSpacing: "1px",
              padding: "12px 24px",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
            }}
          >
            ↻ Reload Application
          </button>
        </div>
      </body>
    </html>
  );
}
