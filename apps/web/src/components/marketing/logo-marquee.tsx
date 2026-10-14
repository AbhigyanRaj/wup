/*
 * Kit logo marquee (home.md §2): centred eyebrow, then an endless row of
 * monochrome marks with faded edges. The list is rendered twice for the
 * seamless -50% loop; the copy is aria-hidden. Hover pauses; reduced motion stops it.
 */

export interface MarqueeLogo {
  name: string;
  src: string;
}

export const WORKS_WITH: MarqueeLogo[] = [
  { name: "MongoDB", src: "/logos/mongodb.svg" },
  { name: "Google Sheets", src: "/logos/google-sheets.svg" },
  { name: "PDF", src: "/logos/pdf.svg" },
  { name: "Gemini", src: "/logos/gemini.svg" },
  { name: "OpenAI", src: "/logos/openai.svg" },
  { name: "Anthropic", src: "/logos/anthropic.svg" },
  { name: "OpenRouter", src: "/logos/openrouter.svg" },
  { name: "Groq", src: "/logos/groq.svg" },
];

function Row({ logos, hidden }: { logos: MarqueeLogo[]; hidden?: boolean }) {
  return (
    <ul role="list" className="contents" aria-hidden={hidden || undefined}>
      {logos.map((l, i) => (
        <li key={`${l.name}-${i}`} className="flex !h-8 shrink-0 items-center gap-2.5 !opacity-100 !filter-none">
          {/* eslint-disable-next-line @next/next/no-img-element -- tiny static SVGs, no optimisation needed */}
          <img src={l.src} alt="" width={26} height={26} className="size-[26px]" loading="eager" decoding="async" />
          <span className="text-[22px] font-medium tracking-[-0.02em] text-[#666]">{l.name}</span>
        </li>
      ))}
    </ul>
  );
}

export function LogoMarquee({ eyebrow = "Works with", logos = WORKS_WITH }: { eyebrow?: string; logos?: MarqueeLogo[] }) {
  // Repeat so one half is always wider than the widest viewport.
  const half = [...logos, ...logos];
  return (
    <div className="marquee container w-full">
      <p className="eyebrow">{eyebrow}</p>
      <div className="marquee__track group" aria-label={`Works with ${logos.map((l) => l.name).join(", ")}`} role="region">
        <div className="marquee__row pr-16 group-hover:[animation-play-state:paused] motion-reduce:animate-none">
          <Row logos={half} />
          <Row logos={half} hidden />
        </div>
      </div>
    </div>
  );
}
