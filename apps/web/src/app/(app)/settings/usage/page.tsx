import type { Metadata } from "next";
import { UsageSettings } from "@/components/settings/usage-settings";

export const metadata: Metadata = { title: "Usage and plan" };

export default function Page() {
  return <UsageSettings />;
}
