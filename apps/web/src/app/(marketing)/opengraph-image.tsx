import { ogForPath } from "@/lib/og";

export { OG_SIZE as size, OG_CONTENT_TYPE as contentType } from "@/lib/og";
export const alt = "wuup: AI data analyst for MongoDB, Google Sheets and PDFs";

export default function Image() {
  return ogForPath("/");
}
