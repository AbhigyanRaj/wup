import { ogForPath } from "@/lib/og";
export { OG_SIZE as size, OG_CONTENT_TYPE as contentType } from "@/lib/og";

export const alt = "wuup glossary";

export default function Image() {
  return ogForPath("/glossary", { template: "glossary", eyebrow: "Glossary", title: "The words behind AI data analysis" });
}
