import { ogForPath } from "@/lib/og";
export { OG_SIZE as size, OG_CONTENT_TYPE as contentType } from "@/lib/og";

export const alt = "Bring your own AI key to wuup";

export default function Image() {
  return ogForPath("/byok");
}
