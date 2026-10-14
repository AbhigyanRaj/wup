import { ogForPath } from "@/lib/og";
export { OG_SIZE as size, OG_CONTENT_TYPE as contentType } from "@/lib/og";

export const alt = "wuup features: an AI data analyst that shows its work";

export default function Image() {
  return ogForPath("/features");
}
