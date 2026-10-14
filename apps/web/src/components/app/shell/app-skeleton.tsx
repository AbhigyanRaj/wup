import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder shell shown while the session is checked. Mirrors the real layout. */
export function AppSkeleton() {
  return (
    <div className="flex h-dvh overflow-hidden bg-bg" aria-busy="true" aria-label="Loading wuup">
      <div className="hidden h-dvh w-[272px] shrink-0 flex-col border-r border-st-secondary bg-sf-white lg:flex">
        <div className="flex h-14 items-center px-[18px]">
          <Skeleton style={{ height: 18, width: 64 }} />
        </div>
        <div className="space-y-2 px-3 pt-1">
          <Skeleton shape="pill" style={{ height: 40 }} />
          <Skeleton style={{ height: 34, borderRadius: 8 }} className="opacity-60" />
          <Skeleton style={{ height: 34, borderRadius: 8 }} className="opacity-60" />
        </div>
        <div className="space-y-3.5 px-5 pt-8">
          {[70, 86, 62, 78, 54].map((w, i) => (
            <Skeleton key={i} style={{ height: 12, width: `${w}%` }} />
          ))}
        </div>
        <div className="mt-auto border-t border-st-secondary p-3">
          <Skeleton style={{ height: 88, borderRadius: 12 }} />
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="h-14 border-b border-st-secondary" />
        <div className="mx-auto w-full max-w-[720px] space-y-4 px-6 pt-16">
          <Skeleton style={{ height: 28, width: "40%" }} />
          <Skeleton style={{ height: 14, width: "70%" }} />
          <Skeleton style={{ height: 14, width: "55%" }} />
        </div>
      </div>
    </div>
  );
}
