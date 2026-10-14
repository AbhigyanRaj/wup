import { ogForPath } from "@/lib/og";
export { OG_SIZE as size, OG_CONTENT_TYPE as contentType } from "@/lib/og";

export const alt = "wuup documentation";

export default function Image() {
  return ogForPath("/docs", { template: "docs", eyebrow: "Docs", title: "wuup documentation" });
}
