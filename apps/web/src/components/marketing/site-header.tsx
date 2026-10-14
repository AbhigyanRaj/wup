import { resolveNav } from "@/content/nav";
import { isLive } from "@/lib/registry";
import { HeaderClient, type HeaderMenu } from "./header-client";

/*
 * Kit "transparent sticky header" (home.md §1). Server part: resolves the nav
 * from the registry (unpublished links are dropped) and picks a featured card
 * per mega menu. Everything interactive lives in the HeaderClient island.
 */

const FEATURED: Record<string, Array<{ href: string; title: string; caption: string; tone: string }>> = {
  Product: [
    {
      href: "/login?demo=1",
      title: "Try the demo",
      caption: "Ask questions of a sample store in an isolated sandbox. No signup.",
      tone: "linear-gradient(160deg, #0b5cff 0%, #5b8def 45%, #c4b5fd 100%)",
    },
  ],
  "Use cases": [
    {
      href: "/chat-with-mongodb",
      title: "Chat with MongoDB",
      caption: "Read-only, schema-aware answers with the queries behind them.",
      tone: "linear-gradient(160deg, #11115b 0%, #2563eb 55%, #7dd3fc 100%)",
    },
    {
      href: "/features",
      title: "See every feature",
      caption: "Connect, scope, ask and verify, in one tour.",
      tone: "linear-gradient(160deg, #11115b 0%, #2563eb 55%, #7dd3fc 100%)",
    },
  ],
  Resources: [
    {
      href: "/tools/mongodb-query-generator",
      title: "MongoDB query generator",
      caption: "Describe the data you want. Get a find or aggregate you can run.",
      tone: "linear-gradient(160deg, #1e3a8a 0%, #556adc 50%, #c4b5fd 100%)",
    },
    {
      href: "/security",
      title: "The security model",
      caption: "What wuup can read, what it cannot, and what stays your job.",
      tone: "linear-gradient(160deg, #1e3a8a 0%, #556adc 50%, #c4b5fd 100%)",
    },
  ],
};

export function SiteHeader({ overHero = true }: { overHero?: boolean }) {
  const nav = resolveNav();
  const menus: HeaderMenu[] = nav.header
    .filter((g) => g.links.length > 0)
    .map((g) => ({
      label: g.label,
      links: g.links.filter((l) => l.path !== "/pricing").map((l) => ({ path: l.path, label: l.label ?? l.path, description: l.description ?? "" })),
      featured: (FEATURED[g.label] ?? []).find((f) => f.href.startsWith("/login") || isLive(f.href.split("?")[0]!)),
    }))
    .filter((m) => m.links.length > 0);

  return <HeaderClient menus={menus} pricingLive={isLive("/pricing")} overHero={overHero} />;
}
