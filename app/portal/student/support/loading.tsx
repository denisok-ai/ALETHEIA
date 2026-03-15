/**
 * Loading fallback for support page.
 */
export default function SupportLoading() {
  return (
    <div className="space-y-6">
      <div className="h-5 w-32 animate-pulse rounded bg-[#F1F5F9]" />
      <div className="h-8 w-48 animate-pulse rounded bg-[#F1F5F9]" />
      <div className="h-48 animate-pulse rounded-xl bg-[#F1F5F9]" />
      <div className="space-y-3">
        <div className="h-12 animate-pulse rounded bg-[#F1F5F9]" />
        <div className="h-12 animate-pulse rounded bg-[#F1F5F9]" />
        <div className="h-12 animate-pulse rounded bg-[#F1F5F9]" />
      </div>
    </div>
  );
}
