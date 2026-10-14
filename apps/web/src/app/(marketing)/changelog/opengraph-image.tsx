import { ogForPath } from "@/lib/og";
export { OG_SIZE as size, OG_CONTENT_TYPE as contentType } from "@/lib/og";

export const alt = "wuup changelog";

export default function Image() {
  return ogForPath("/changelog", { template: "default", eyebrow: "Changelog", title: "What's new in wuup" });
}
