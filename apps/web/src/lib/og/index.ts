/**
 * OG image helpers for opengraph-image.tsx route files.
 *
 * Static route (src/app/pricing/opengraph-image.tsx):
 *   import { ogForPath } from "@/lib/og";
 *   export { OG_SIZE as size, OG_CONTENT_TYPE as contentType } from "@/lib/og";
 *   export const alt = "wuup pricing";
 *   export default function Image() { return ogForPath("/pricing"); }
 *
 * Dynamic route (src/app/guides/[slug]/opengraph-image.tsx):
 *   export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
 *     return ogForPath(`/guides/${(await params).slug}`);
 *   }
 */

import type { ImageResponse } from "next/og";
import type { OgSpec } from "@/content/types";
import { getPage } from "@/lib/registry";
import { renderOg } from "./render";

export { renderOg, OG_SIZE, OG_CONTENT_TYPE } from "./render";
export type { OgInput } from "./render";

export const OG_DEFAULT: Required<OgSpec> = {
  template: "default",
  eyebrow: "AI data analyst",
  title: "Ask MongoDB, Google Sheets and PDFs in plain English",
};

/** Renders the OG image for a registered page; unknown paths get `fallback`, then the site default. */
export function ogForPath(path: string, fallback: Partial<OgSpec> = {}): Promise<ImageResponse> {
  const page = getPage(path);
  const og = page?.og;
  return renderOg({
    template: og?.template ?? fallback.template ?? OG_DEFAULT.template,
    eyebrow: og?.eyebrow ?? fallback.eyebrow ?? OG_DEFAULT.eyebrow,
    title: og?.title ?? page?.h1 ?? page?.title ?? fallback.title ?? OG_DEFAULT.title,
  });
}
