import { ogForPath } from "@/lib/og";
export { OG_SIZE as size, OG_CONTENT_TYPE as contentType } from "@/lib/og";

export const alt = "wuup Acceptable Use Policy";

export default function Image() {
  return ogForPath("/acceptable-use", { template: "legal", eyebrow: "Legal" });
}
