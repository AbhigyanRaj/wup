import type { Metadata } from "next";
import { ModelsSettings } from "@/components/settings/models-settings";

export const metadata: Metadata = { title: "Models and keys" };

export default function Page() {
  return <ModelsSettings />;
}
