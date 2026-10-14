import { Suspense } from "react";
import type { Metadata } from "next";
import { DataPage } from "@/components/data/data-page";

export const metadata: Metadata = { title: "Data sources" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <DataPage />
    </Suspense>
  );
}
