import { ogForPath } from "@/lib/og";
export { OG_SIZE as size, OG_CONTENT_TYPE as contentType } from "@/lib/og";

export const alt = "wuup Privacy Policy";

export default function Image() {
  return ogForPath("/privacy", { template: "legal", eyebrow: "Legal" });
}
