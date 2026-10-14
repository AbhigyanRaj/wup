import type { Metadata } from "next";
import { noindexMetadata } from "@/lib/seo";
import { AppProviders } from "@/components/providers";
import { AppFrame } from "@/components/app/shell/app-frame";

export const metadata: Metadata = {
  ...noindexMetadata,
  title: { default: "wuup", template: "%s | wuup" },
};

/** Authenticated app shell for /chat, /data and /settings. */
export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <AppProviders>
      <AppFrame>{children}</AppFrame>
    </AppProviders>
  );
}
