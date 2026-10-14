import { Skeleton } from "@/components/ui/skeleton";

/* Placeholder card while a renderer chunk loads. Same footprint as the real card. */

const BARS = [46, 72, 58, 88, 64, 40, 76];

export function RendererSkeleton({ kind = "chart" }: { kind?: "chart" | "table" | "diagram" | "code" }) {
  return (
    <div
      role="status"
      aria-label="Loading visual"
      className="w-full rounded-card border border-st-secondary bg-sf-white p-4 sm:p-6"
    >
      <Skeleton className="h-4 w-44" />
      <Skeleton className="mt-2 h-3 w-24" />
      {kind === "chart" ? (
        <div className="mt-6 flex h-[232px] items-end gap-[6%] border-b border-st-secondary px-[4%]">
          {BARS.map((h, i) => (
            <Skeleton key={i} shape="block" className="flex-1 rounded-b-none rounded-t-md" style={{ height: `${h}%` }} />
          ))}
        </div>
      ) : kind === "table" ? (
        <div className="mt-6 flex flex-col gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className={i === 0 ? "h-3 w-1/2" : "h-4 w-full"} />
          ))}
        </div>
      ) : (
        <Skeleton shape="block" className="mt-6 h-[240px] w-full rounded-xl" />
      )}
    </div>
  );
}
