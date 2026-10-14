import { ogForPath } from "@/lib/og";
export { OG_SIZE as size, OG_CONTENT_TYPE as contentType } from "@/lib/og";

export const alt = "About wuup: built in India for honest answers";

export default function Image() {
  return ogForPath("/about");
}
