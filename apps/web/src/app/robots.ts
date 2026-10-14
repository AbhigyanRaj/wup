import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

/**
 * Everything is crawlable. App routes (/chat, /login, /settings, /data) are
 * kept out of the index with noindex metadata and an X-Robots-Tag header,
 * which only works if crawlers are allowed to fetch them.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/" },
      {
        userAgent: ["OAI-SearchBot", "ChatGPT-User", "Claude-SearchBot", "Claude-User", "PerplexityBot"],
        allow: "/",
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
