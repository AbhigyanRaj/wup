import type { Metadata } from "next";
import { PrivacySettings } from "@/components/settings/privacy-settings";

export const metadata: Metadata = { title: "Privacy and data" };

export default function Page() {
  return <PrivacySettings />;
}
