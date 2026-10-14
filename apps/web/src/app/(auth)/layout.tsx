import type { Metadata } from "next";
import { noindexMetadata } from "@/lib/seo";

/*
 * Auth routes: no marketing header or footer (kit login.md 3.1). The page is
 * an inset white sheet on a light grey frame, always light, at least 100dvh.
 */
export const metadata: Metadata = noindexMetadata;

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main id="main" className="min-h-dvh bg-[#f2f2f2]">
      {children}
    </main>
  );
}
