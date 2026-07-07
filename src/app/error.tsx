"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

/**
 * Next.js Error Boundary — catches unhandled errors in route segments
 * Displays a branded crash recovery UI instead of a white screen.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error for production monitoring (CWE-778)
    console.error("[ERROR_BOUNDARY] Unhandled application error:", error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4 space-y-6">
      <div className="flex flex-col items-center gap-4">
        <img
          src="/icons/icon-192x192.png"
          alt="Logo"
          className="h-14 w-14 object-contain rounded-full border border-slate-200 shadow-sm"
        />
        <div className="p-5 bg-red-50 rounded-full border border-red-200 text-red-500">
          <AlertTriangle size={40} />
        </div>
      </div>

      <div className="space-y-2 max-w-md">
        <h2 className="text-lg font-black text-slate-800 uppercase tracking-wide">
          Something Went Wrong
        </h2>
        <p className="text-xs text-slate-500 leading-relaxed font-semibold">
          An unexpected error occurred in the application. This has been logged for our engineering team. 
          You can try again or return to the main screen.
        </p>
        {error.digest && (
          <p className="text-[10px] text-slate-400 font-mono mt-2">
            Reference: {error.digest}
          </p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <button
          onClick={reset}
          className="bg-blue text-white font-bold uppercase text-xs tracking-wider px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-sky-700 transition-colors cursor-pointer"
        >
          <RotateCcw size={14} />
          <span>Try Again</span>
        </button>

        <a
          href="/login"
          className="text-xs font-bold text-slate-500 hover:text-slate-700 flex items-center gap-1.5 cursor-pointer"
        >
          <Home size={13} />
          <span>Return Home</span>
        </a>
      </div>
    </div>
  );
}
