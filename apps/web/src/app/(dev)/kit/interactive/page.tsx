import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InteractiveKitDemo } from "./demo";

export const metadata: Metadata = {
  title: "Interactive kit",
  robots: { index: false, follow: false },
};

/** Dev-only gallery of the interactive UI primitives. 404s in production. */
export default function InteractiveKitPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <InteractiveKitDemo />;
}
