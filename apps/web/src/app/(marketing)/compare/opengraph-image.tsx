import { ogForPath } from "@/lib/og";
export { OG_SIZE as size, OG_CONTENT_TYPE as contentType } from "@/lib/og";

export const alt = "wuup comparisons";

export default function Image() {
  return ogForPath("/compare", { template: "compare", eyebrow: "Compare", title: "How wuup compares, honestly" });
}
