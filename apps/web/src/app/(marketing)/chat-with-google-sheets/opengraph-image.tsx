import { ogForPath } from "@/lib/og";
export { OG_SIZE as size, OG_CONTENT_TYPE as contentType } from "@/lib/og";

export const alt = "Chat with Google Sheets in plain English with wuup";

export default function Image() {
  return ogForPath("/chat-with-google-sheets");
}
