/**
 * Loading fallback for verifications page.
 */
export default function VerificationsLoading() {
  return (
    <div className="space-y-6">
      <div className="h-5 w-32 animate-pulse rounded bg-[#F1F5F9]" />
      <div className="h-8 w-48 animate-pulse rounded bg-[#F1F5F9]" />
      <div className="space-y-3">
        <div className="h-14 animate-pulse rounded bg-[#F1F5F9]" />
        <div className="h-14 animate-pulse rounded bg-[#F1F5F9]" />
        <div className="h-14 animate-pulse rounded bg-[#F1F5F9]" />
        <div className="h-14 animate-pulse rounded bg-[#F1F5F9]" />
      </div>
    </div>
  );
}
