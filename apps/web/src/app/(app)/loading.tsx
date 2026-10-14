import { Skeleton } from "@/components/ui/skeleton";

export default function AppLoading() {
  return (
    <div className="mx-auto w-full max-w-[880px] px-4 pt-10 sm:px-6 lg:pt-14" aria-busy="true" aria-label="Loading">
      <Skeleton style={{ height: 28, width: "36%" }} />
      <Skeleton style={{ height: 14, width: "58%", marginTop: 14 }} />
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Skeleton shape="block" style={{ height: 120 }} />
        <Skeleton shape="block" style={{ height: 120 }} />
      </div>
    </div>
  );
}
