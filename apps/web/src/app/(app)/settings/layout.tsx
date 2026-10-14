import type { Metadata } from "next";
import { SettingsNav } from "@/components/settings/settings-ui";

export const metadata: Metadata = { title: { default: "Settings", template: "%s | Settings | wuup" } };

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pb-24 pt-8 sm:px-6 md:pt-12 lg:px-10">
      <h1 className="font-display text-[32px] font-display-medium leading-[1.15] tracking-[-0.02em] text-tx">Settings</h1>
      <div className="mt-6 grid gap-6 md:mt-10 md:grid-cols-[220px_minmax(0,1fr)] md:gap-12">
        <SettingsNav />
        <div className="min-w-0 max-w-[720px]">{children}</div>
      </div>
    </div>
  );
}
