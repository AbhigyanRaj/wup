import { ogForPath } from "@/lib/og";
export { OG_SIZE as size, OG_CONTENT_TYPE as contentType } from "@/lib/og";

export const alt = "wuup pricing: free to start, your key to scale";

export default function Image() {
  return ogForPath("/pricing");
}
