export default function PageLoader() {
  return (
    <div
      className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-5"
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-white" />
      <span className="font-sans text-[13px] font-medium text-[#6b6b6b]">
        Loading…
      </span>
    </div>
  );
}
