import { ogForPath } from "@/lib/og";
export { OG_SIZE as size, OG_CONTENT_TYPE as contentType } from "@/lib/og";

export const alt = "wuup use cases";

export default function Image() {
  return ogForPath("/use-cases", { template: "use-case", eyebrow: "Use cases", title: "What teams ask their data" });
}
