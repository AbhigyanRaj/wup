import type { MetadataRoute } from "next";
import { getPublishedPages } from "@/lib/registry";
import { absoluteUrl } from "@/lib/site";

/** Published pages only. No priority or changefreq: search engines ignore them. */
export default function sitemap(): MetadataRoute.Sitemap {
  return getPublishedPages()
    .slice()
    .sort((a, b) => (a.path === "/" ? -1 : b.path === "/" ? 1 : a.path.localeCompare(b.path)))
    .map((page) => ({
      url: absoluteUrl(page.path),
      lastModified: page.updated,
    }));
}
