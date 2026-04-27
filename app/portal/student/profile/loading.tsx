/**
 * Loading fallback for profile page.
 */
export default function ProfileLoading() {
  return (
    <div className="space-y-6">
      <div className="h-5 w-32 animate-pulse rounded bg-[#F1F5F9]" />
      <div className="h-8 w-48 animate-pulse rounded bg-[#F1F5F9]" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
        <div className="h-24 animate-pulse rounded-xl bg-[#F1F5F9] lg:col-span-4" />
        <div className="h-48 animate-pulse rounded-xl bg-[#F1F5F9] lg:col-span-8" />
      </div>
    </div>
  );
}
