import { ogForPath } from "@/lib/og";
export { OG_SIZE as size, OG_CONTENT_TYPE as contentType } from "@/lib/og";

export const alt = "wuup Terms of Service";

export default function Image() {
  return ogForPath("/terms", { template: "legal", eyebrow: "Legal" });
}
