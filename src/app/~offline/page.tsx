"use client";

import { WifiOff, RotateCcw } from "lucide-react";

export default function OfflineFallback() {
  const handleRetry = () => {
    if (typeof window !== "undefined") {
      window.location.href = "/surveyor";
    }
  };

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4 space-y-6">
      <div className="flex flex-col items-center gap-4">
        <img
          src="/icons/icon-192x192.png"
          alt="Adani Port Logo"
          className="h-16 w-16 object-contain rounded-xl border border-white/10"
        />
        <div className="p-6 bg-amber-500/10 rounded-full border border-amber-500/20 text-amber-500 animate-pulse">
          <WifiOff size={48} />
        </div>
      </div>

      <div className="space-y-2 max-w-md">
        <h2 className="text-xl font-bold text-slate-100 uppercase tracking-wide">
          Offline Mode
        </h2>
        <p className="text-xs text-slate-400 leading-relaxed">
          You are currently deep inside a cell signal dead zone at the port. You can still input new movements! The app will automatically save your logs locally.
        </p>
      </div>

      <button
        onClick={handleRetry}
        className="bg-teal text-slate-950 font-bold uppercase text-xs tracking-wider px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-[#00e0b0] transition-colors btn-touch cursor-pointer"
      >
        <RotateCcw size={16} />
        <span>Return to Form</span>
      </button>
    </div>
  );
}
