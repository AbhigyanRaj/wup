import { ogForPath } from "@/lib/og";
export { OG_SIZE as size, OG_CONTENT_TYPE as contentType } from "@/lib/og";

export const alt = "wuup guides: MongoDB, Google Sheets and AI data analysis";

export default function Image() {
  return ogForPath("/guides", { template: "guide", eyebrow: "Guides", title: "Guides for asking your data questions" });
}
