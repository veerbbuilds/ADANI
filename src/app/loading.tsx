/**
 * Route loading skeleton — displayed during page transitions
 */
export default function Loading() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
      <div className="h-8 w-8 border-4 border-blue border-t-transparent rounded-full animate-spin"></div>
      <span className="text-xs text-slate-400 font-semibold tracking-widest uppercase animate-pulse">
        Loading...
      </span>
    </div>
  );
}
