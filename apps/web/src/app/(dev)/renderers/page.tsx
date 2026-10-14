import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RenderersGallery } from "@/components/renderers/dev-gallery";

export const metadata: Metadata = {
  title: "Renderers",
  robots: { index: false, follow: false },
};

/*
 * Visual QA for the answer renderers. Dev only: 404 in production builds unless
 * the build sets WUUP_DEV_GALLERY=1 (local visual checks against `next start`).
 */
export default function RenderersPage() {
  if (process.env.NODE_ENV === "production" && process.env.WUUP_DEV_GALLERY !== "1") notFound();
  return <RenderersGallery />;
}
