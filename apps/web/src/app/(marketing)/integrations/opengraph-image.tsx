import { ogForPath } from "@/lib/og";
export { OG_SIZE as size, OG_CONTENT_TYPE as contentType } from "@/lib/og";

export const alt = "wuup integrations";

export default function Image() {
  return ogForPath("/integrations", { template: "default", eyebrow: "Integrations", title: "Bring the model you already pay for" });
}
