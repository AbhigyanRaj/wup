import { HubTemplate, type HubItem } from "@/components/marketing/templates/hub-template";
import { PROVIDER_LOGO } from "@/components/marketing/templates/integration-template";
import { integrations } from "@/content/data/integrations";
import { getPage, isLive } from "@/lib/registry";
import { pageMetadata } from "@/lib/seo";

const PATH = "/integrations";
const FALLBACK = {
  title: "Integrations: bring your own AI model key",
  description:
    "Use wuup with your own OpenAI, Anthropic, OpenRouter or Gemini API key. Unlimited questions over MongoDB, Sheets and PDFs, billed by your provider.",
};
export const metadata = pageMetadata(PATH, getPage(PATH) ? {} : FALLBACK);

export default function IntegrationsHub() {
  const items: HubItem[] = integrations
    .filter((i) => isLive(i.path))
    .map((i) => ({
      path: i.path,
      title: i.partner.name,
      description: i.summary,
      chips: ["Model provider", "BYOK", "No markup"],
      tint: i.tint === "periwinkle" ? "violet" : i.tint,
      logo: PROVIDER_LOGO[i.provider],
    }));
  return (
    <HubTemplate
      path={PATH}
      eyebrow="Integrations"
      title={"Bring the model\nyou already pay for"}
      lead="wuup works with four model providers. Add your own key and every question runs on the model you choose, billed by the provider, with nothing added by wuup."
      groups={[{ items }]}
      cta={{ title: "Your key, your model.\nYour data, read-only.", secondary: { label: "How BYOK works", href: "/byok" } }}
    />
  );
}
