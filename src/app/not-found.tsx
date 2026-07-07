import Link from "next/link";
import { Search, ArrowLeft } from "lucide-react";

/**
 * Branded 404 Page — replaces generic Next.js not-found
 */
export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4 space-y-6">
      <div className="flex flex-col items-center gap-4">
        <img
          src="/icons/icon-192x192.png"
          alt="Logo"
          className="h-14 w-14 object-contain rounded-full border border-slate-200 shadow-sm"
        />
        <div className="p-5 bg-amber-50 rounded-full border border-amber-200 text-amber-500">
          <Search size={40} />
        </div>
      </div>

      <div className="space-y-2 max-w-md">
        <h2 className="text-lg font-black text-slate-800 uppercase tracking-wide">
          Page Not Found
        </h2>
        <p className="text-xs text-slate-500 leading-relaxed font-semibold">
          The requested page does not exist in the Adani Port Logistics system. 
          Please check the URL or return to the main application.
        </p>
      </div>

      <Link
        href="/login"
        className="bg-blue text-white font-bold uppercase text-xs tracking-wider px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-sky-700 transition-colors cursor-pointer"
      >
        <ArrowLeft size={14} />
        <span>Return to Login</span>
      </Link>
    </div>
  );
}
