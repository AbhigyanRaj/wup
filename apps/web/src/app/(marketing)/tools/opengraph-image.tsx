import { ogForPath } from "@/lib/og";
export { OG_SIZE as size, OG_CONTENT_TYPE as contentType } from "@/lib/og";

export const alt = "Free MongoDB tools by wuup";

export default function Image() {
  return ogForPath("/tools", { template: "tool", eyebrow: "Free tools", title: "Free MongoDB tools, no signup" });
}
