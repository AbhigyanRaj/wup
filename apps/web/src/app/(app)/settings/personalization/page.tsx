import type { Metadata } from "next";
import { PersonalizationSettings } from "@/components/settings/personalization-settings";

export const metadata: Metadata = { title: "Personalization" };

export default function Page() {
  return <PersonalizationSettings />;
}
