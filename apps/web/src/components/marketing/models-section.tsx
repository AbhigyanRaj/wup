import { ButtonLink } from "@/components/ui/button";
import { Checklist } from "@/components/ui/checklist";
import { SectionHead } from "@/components/ui/section";
import { FACTS } from "@/lib/site";

/*
 * Kit "checklist cards + badge card" (home.md §9), used for wuup's model
 * options: the free tier, bring-your-own-key, and a wide card with provider
 * badges (monochrome marks in tinted chips that wiggle on hover).
 */

const PROVIDERS = [
  { name: "OpenAI", logo: "/logos/openai.svg", tone: "badge--indigo" },
  { name: "Anthropic", logo: "/logos/anthropic.svg", tone: "badge--sky" },
  { name: "OpenRouter", logo: "/logos/openrouter.svg", tone: "badge--green" },
  { name: "Gemini", logo: "/logos/gemini.svg", tone: "badge--pink" },
  { name: "Groq", logo: "/logos/groq.svg", tone: "badge--yellow" },
] as const;

export function ModelsSection() {
  return (
    <section className="container section" aria-label="Models and pricing">
      <SectionHead
        title={"Start free.\nThen bring your own key."}
        intro="No subscription and no markup. Use the free questions, then plug in the AI provider you already pay for."
      />
      <div className="flex w-full flex-col gap-2">
        <div className="grid-2">
          <div className="card">
            <p className="text-[13px] font-medium text-tx-tertiary">Free</p>
            <h3 className="h-card mt-2">{FACTS.freeQuestions} questions on Gemini</h3>
            <p className="body-muted mt-2.5">Enough to connect a real source and see how wuup answers. No card, no trial clock.</p>
            <Checklist
              items={[
                "MongoDB, Google Sheets and PDF sources",
                "Charts and tables from returned rows",
                "Queries used on every answer",
                "The same read-only guard as every plan",
              ]}
            />
          </div>
          <div className="card">
            <p className="text-[13px] font-medium text-tx-tertiary">Bring your own key</p>
            <h3 className="h-card mt-2">Unlimited questions, your provider&apos;s bill</h3>
            <p className="body-muted mt-2.5">Add an API key and choose the model. Requests go to your provider, and wuup charges nothing on top.</p>
            <Checklist
              items={[
                "OpenAI, Anthropic, OpenRouter, Gemini or Groq",
                "Choose the model you want",
                "Key masked in the app",
                "Remove it at any time",
              ]}
            />
          </div>
        </div>
        <div className="card flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-[512px]">
            <h3 className="h-card">Works with the models you already pay for</h3>
            <p className="body-muted mt-2.5">
              Switch providers whenever you like, for example to Groq when speed matters most. Your sources, chats and documents stay exactly where they are.
            </p>
          </div>
          <ul role="list" className="flex flex-wrap gap-2 md:max-w-[520px] md:justify-end lg:max-w-none lg:flex-nowrap">
            {PROVIDERS.map((p) => (
              <li key={p.name} className={`badge ${p.tone}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- tiny static mark */}
                <img src={p.logo} alt="" width={16} height={16} className="size-4 opacity-80" />
                {p.name}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <ButtonLink href="/pricing" variant="ink">
        See pricing
      </ButtonLink>
    </section>
  );
}
