import { ogForPath } from "@/lib/og";
export { OG_SIZE as size, OG_CONTENT_TYPE as contentType } from "@/lib/og";

export const alt = "wuup security: read-only AI access to your database";

export default function Image() {
  return ogForPath("/security");
}
