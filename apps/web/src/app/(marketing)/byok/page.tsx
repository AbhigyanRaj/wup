import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ClipboardPaste,
  KeyRound,
  ListChecks,
  MessageSquareText,
  RefreshCw,
  Repeat2,
  Trash2,
} from "lucide-react";
import { CtaBand } from "@/components/marketing/cta-band";
import { FaqSection } from "@/components/marketing/faq";
import { HeroCompact } from "@/components/marketing/hero-compact";
import { InnerSheet, PageSheetEnd } from "@/components/marketing/page-sheet";
import { JsonLd } from "@/components/seo/JsonLd";
import { ButtonLink } from "@/components/ui/button";
import { SectionHead } from "@/components/ui/section";
import { getFaqGroup } from "@/content/data/faqs";
import { breadcrumbList, graph } from "@/lib/jsonld";
import { breadcrumbsFor, getPage } from "@/lib/registry";
import { pageMetadata } from "@/lib/seo";
import { FACTS, SIGNUP, shipped } from "@/lib/site";
import { KeyInset } from "../features/_components/mocks";

const PATH = "/byok";
export const metadata = pageMetadata(PATH);

const PROVIDERS = [
  {
    name: "OpenAI",
    logo: "/logos/openai.svg",
    blurb: "Use the OpenAI models your account has access to.",
    prefix: "sk-",
    keys: "https://platform.openai.com/api-keys",
    pricing: "https://openai.com/api/pricing/",
  },
  {
    name: "Anthropic",
    logo: "/logos/anthropic.svg",
    blurb: "Answer with Claude models from your Anthropic console.",
    prefix: "sk-ant-",
    keys: "https://console.anthropic.com/settings/keys",
    pricing: "https://www.anthropic.com/pricing",
  },
  {
    name: "OpenRouter",
    logo: "/logos/openrouter.svg",
    blurb: "One key for many model families, billed through OpenRouter.",
    prefix: "sk-or-",
    keys: "https://openrouter.ai/keys",
    pricing: "https://openrouter.ai/models",
  },
  {
    name: "Gemini",
    logo: "/logos/gemini.svg",
    blurb: "Keep the model family your free questions used, on your own key.",
    prefix: "AIza",
    keys: "https://aistudio.google.com/apikey",
    pricing: "https://ai.google.dev/gemini-api/docs/pricing",
  },
];

const STEPS = [
  { icon: <KeyRound />, title: "Create a key at your provider", body: "In the provider's console, create an API key for wuup. A separate key makes it easy to track and revoke." },
  { icon: <ClipboardPaste />, title: "Paste it in Settings", body: "Choose the provider and paste the key. It is saved to your account only." },
  { icon: <ListChecks />, title: "wuup checks it", body: "wuup lists your provider's models with the key, so a typo or an expired key is caught right away." },
  { icon: <MessageSquareText />, title: "Pick a model and ask", body: "Choose from the models your key can use. Every question after that runs on your key." },
];

const PRIVACY = [
  "Requests go from wuup to your provider with your key. Nobody else's questions use it.",
  shipped.byokKeyEncrypted
    ? "The key is encrypted with AES-256-GCM before it is stored."
    : "The key is stored on your account and used only for your questions.",
  "After saving, the app only shows a masked version, like sk-ant-••••3f9a.",
  "Your provider's own terms apply to the requests made with your key.",
];

const MANAGE = [
  { icon: <Repeat2 />, title: "Switch providers", body: "Replace the key with one from another provider. Your chats, connections and documents stay as they are." },
  { icon: <RefreshCw />, title: "Change the model", body: "Pick a different model from your provider's list whenever you like, for example a smaller one for routine questions." },
  { icon: <Trash2 />, title: "Remove the key", body: "Remove it in Settings and wuup stops using it immediately. Any free questions you have left still work." },
];

export default function ByokPage() {
  const h1 = getPage(PATH)?.h1 ?? "Your key.\nYour model.";
  const faqs = getFaqGroup("byok")?.items ?? [];
  return (
    <>
      <JsonLd data={graph(breadcrumbList(breadcrumbsFor(PATH)))} />
      <InnerSheet>
        <HeroCompact
          eyebrow="Bring your own key"
          title={h1}
          lead={`After your ${FACTS.freeQuestions} free questions on Gemini, add an API key from ${FACTS.byokProviders.join(", ")}. You pick the model, your provider bills you directly, and wuup charges nothing.`}
          actions={
            <>
              <ButtonLink href={SIGNUP} variant="hero-primary">
                Start free
              </ButtonLink>
              <ButtonLink href="/docs/byok-setup" variant="hero-outline">
                Read the setup guide
              </ButtonLink>
            </>
          }
        />

        <section className="container section -mt-8 md:-mt-16" aria-label="Supported providers">
          <SectionHead
            title={"Four providers,\none setting"}
            intro="Use the account you already have. Each card links to the provider's key page and its own price list."
          />
          <ul className="m-0 grid w-full list-none gap-2 p-0 sm:grid-cols-2 lg:grid-cols-4">
            {PROVIDERS.map((p) => (
              <li key={p.name} className="group relative flex flex-col overflow-hidden rounded-card border border-st-secondary bg-sf-white transition-[border-color,box-shadow] duration-300 hover:border-indigo-200 hover:shadow-card-hover">
                <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-[radial-gradient(circle,rgba(125,211,252,.5),rgba(165,187,252,.3)_40%,transparent_70%)] opacity-0 blur-lg transition-opacity duration-300 group-hover:opacity-100" />
                <div className="relative flex flex-1 flex-col gap-4 p-6">
                  <span className="grid size-12 place-items-center rounded-xl border border-st-secondary bg-sf-white shadow-[0_1px_2px_rgba(0,0,0,.04)]">
                    <Image src={p.logo} alt="" width={24} height={24} className="size-6" />
                  </span>
                  <span className="flex flex-col gap-1.5">
                    <span className="text-heading-card font-medium leading-[1.3] text-tx">{p.name}</span>
                    <span className="text-caption leading-[1.55] text-tx-tertiary">{p.blurb}</span>
                  </span>
                  <span className="mt-auto w-fit rounded-lg border border-st-secondary bg-sf px-2 py-1 font-mono text-[12px] text-tx-secondary">
                    {p.prefix}
                    <span className="tracking-[0.15em] text-tx-muted">••••••</span>
                  </span>
                </div>
                <div className="relative flex flex-col border-t border-st-secondary">
                  <a href={p.keys} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between px-6 py-3 text-caption text-tx-secondary transition-colors hover:bg-sf-secondary hover:text-tx">
                    Get a key
                    <ArrowUpRight className="size-4 text-tx-muted" aria-hidden="true" />
                    <span className="sr-only">(opens {p.name} in a new tab)</span>
                  </a>
                  <a href={p.pricing} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between border-t border-st-secondary px-6 py-3 text-caption text-tx-secondary transition-colors hover:bg-sf-secondary hover:text-tx">
                    {p.name} pricing
                    <ArrowUpRight className="size-4 text-tx-muted" aria-hidden="true" />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="container section" aria-label="How it works">
          <SectionHead title={"How it works"} intro="About two minutes, most of it in your provider's console." />
          <div className="grid w-full items-stretch gap-4 lg:grid-cols-[1fr_1.2fr]">
            <ol className="m-0 flex list-none flex-col gap-2 p-0">
              {STEPS.map((s, i) => (
                <li key={s.title} className="grid grid-cols-[44px_1fr] gap-4 rounded-2xl border border-st-secondary bg-sf-white p-5">
                  <span aria-hidden="true" className="grid size-11 place-items-center rounded-xl bg-indigo-50 text-indigo-800 shadow-[inset_0_0_0_1px_var(--indigo-100)] [&_svg]:size-5 [&_svg]:stroke-[1.5]">
                    {s.icon}
                  </span>
                  <span className="flex flex-col gap-1">
                    <span className="flex items-baseline gap-2">
                      <span className="font-mono text-label text-tx-muted">0{i + 1}</span>
                      <span className="text-body-lg font-medium leading-[1.35] text-tx">{s.title}</span>
                    </span>
                    <span className="text-caption leading-[1.6] text-tx-tertiary md:text-body">{s.body}</span>
                  </span>
                </li>
              ))}
            </ol>
            <div className="relative min-h-[400px] overflow-hidden rounded-2xl border border-st">
              <Image src="/images/mats/periwinkle.webp" alt="" fill sizes="(min-width: 1024px) 640px, 88vw" className="object-cover" />
              <div className="absolute inset-x-4 bottom-0 top-8 overflow-hidden rounded-t-2xl border border-white/70 bg-sf-white shadow-[0_0_0_6px_rgba(255,255,255,.28)] md:inset-x-10 md:top-12">
                <KeyInset />
              </div>
            </div>
          </div>
          <Link href="/docs/byok-setup" className="link-arrow">
            <BookOpen className="size-4" aria-hidden="true" /> Step-by-step setup guide
          </Link>
        </section>

        <section className="container section" aria-label="Cost transparency">
          <SectionHead
            title={"You pay your provider.\nNot us."}
            intro="wuup adds no markup, no subscription and no per-question fee on top of your key. Your provider's posted rates are the whole cost."
          />
          <div className="grid w-full gap-4 md:grid-cols-[1fr_1.15fr]">
            <div className="flex flex-col justify-between gap-8 rounded-2xl border border-indigo-200 bg-[linear-gradient(160deg,var(--indigo-50),#fff_55%)] p-6 md:p-10">
              <div className="flex flex-col gap-3">
                <p className="eyebrow">What wuup charges</p>
                <p className="font-display text-[44px] leading-none tracking-[-0.02em] text-indigo-950 md:text-[56px]">Nothing</p>
                <p className="max-w-sm text-body leading-[1.6] text-tx-secondary">
                  for every question on your key. There is no wuup invoice to read, only your provider&apos;s usage page.
                </p>
              </div>
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                {["Billed per token by your provider", "Usage shows in your provider's dashboard", "Spend limits live in your provider's console"].map((t) => (
                  <li key={t} className="flex items-center gap-2.5 text-body text-tx">
                    <Check className="size-4 shrink-0 text-indigo-600" strokeWidth={2} aria-hidden="true" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col overflow-hidden rounded-2xl border border-st bg-sf-white">
              <p className="border-b border-st-secondary px-6 py-4 text-body font-medium text-tx md:px-8">Check the rates where they are set</p>
              <ul className="m-0 flex list-none flex-col p-0">
                {PROVIDERS.map((p) => (
                  <li key={p.name} className="border-b border-st-secondary last:border-b-0">
                    <a
                      href={p.pricing}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-4 px-6 py-4 transition-colors hover:bg-sf-secondary md:px-8"
                    >
                      <Image src={p.logo} alt="" width={20} height={20} className="size-5" />
                      <span className="flex flex-col">
                        <span className="text-body font-medium text-tx">{p.name} pricing</span>
                        <span className="text-caption text-tx-tertiary">{new URL(p.pricing).host}</span>
                      </span>
                      <ArrowUpRight className="ml-auto size-4 text-tx-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-auto bg-sf px-6 py-4 text-caption leading-[1.6] text-tx-tertiary md:px-8">
                Prices change, so we link to them rather than copy them. Longer answers and research use more tokens than a quick lookup.
              </p>
            </div>
          </div>
        </section>

        <section className="container section" aria-label="Privacy and key management">
          <SectionHead title={"Private, and easy to change"} intro="Your key works for you only, and you can swap or remove it at any time." />
          <div className="grid w-full gap-4 lg:grid-cols-[1fr_1.5fr]">
            <div className="flex flex-col gap-5 rounded-2xl border border-st bg-sf-white p-6 md:p-8">
              <span className="grid size-12 place-items-center rounded-xl bg-indigo-100 text-indigo-800">
                <KeyRound className="size-6" strokeWidth={1.5} aria-hidden="true" />
              </span>
              <h3 className="text-heading-4 font-medium leading-[1.3] text-tx">How your key is handled</h3>
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {PRIVACY.map((f) => (
                  <li key={f} className="flex gap-3 text-body leading-[1.55] text-tx-secondary">
                    <Check className="mt-1 size-4 shrink-0 text-indigo-600" strokeWidth={2} aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/security" className="link-arrow mt-auto text-caption">
                Read the security overview <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
            <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-3 lg:grid-cols-1">
              {MANAGE.map((m) => (
                <li key={m.title} className="option-card items-start sm:flex-col lg:flex-row lg:items-center">
                  <span aria-hidden="true" className="option-card__tile grid size-16 place-items-center text-blue-700 [background:var(--gradient-blue-pale)] [&_svg]:size-6 [&_svg]:stroke-[1.5] md:size-20">
                    {m.icon}
                  </span>
                  <span className="flex flex-col">
                    <span className="option-card__title">{m.title}</span>
                    <span className="option-card__desc">{m.body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {faqs.length ? <FaqSection title={"Questions about\nyour own key"} items={faqs} /> : null}

        <CtaBand
          title={"Start free.\nBring your key later."}
          secondary={{ label: "Setup guide", href: "/docs/byok-setup" }}
        />
      </InnerSheet>
      <PageSheetEnd className="md:-mt-12" />
    </>
  );
}
