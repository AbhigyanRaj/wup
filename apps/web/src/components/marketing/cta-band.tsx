import { ButtonLink } from "@/components/ui/button";
import { withLineBreaks } from "@/components/ui/section";
import { SIGNUP } from "@/lib/site";

/*
 * Kit "dusk CTA band" (home.md §13): container-width card, 2px #e6e6e6 outline
 * offset 2px, dusk-blue gradient with grain and faint concentric rings, white
 * display headline over two lines, a small ornament, then the buttons.
 */

export interface CtaAction {
  label: string;
  href: string;
}

export interface CtaBandProps {
  /** Use "\n" for the line break. */
  title?: string;
  primary?: CtaAction;
  secondary?: CtaAction;
}

export function CtaBand({
  title = "Your data has answers.\nStart asking.",
  primary = { label: "Start free", href: SIGNUP },
  secondary = { label: "Read the docs", href: "/docs" },
}: CtaBandProps) {
  return (
    <section className="container" aria-label="Get started">
      <div className="cta-band">
        <div className="cta-band__inner">
          <div className="cta-band__noise" aria-hidden="true" />
          <div className="cta-band__rings" aria-hidden="true" />
          <svg
            className="pointer-events-none absolute left-1/2 top-[48%] h-14 w-14 -translate-x-1/2 text-white/90 drop-shadow-[0_0_18px_rgba(196,181,253,0.9)]"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              fill="currentColor"
              d="M12 1.5c.4 5.6 4.9 10.1 10.5 10.5-5.6.4-10.1 4.9-10.5 10.5-.4-5.6-4.9-10.1-10.5-10.5C7.1 11.6 11.6 7.1 12 1.5z"
            />
          </svg>
          <div className="relative z-[1] flex w-full flex-col items-center gap-6">
            <h2 className="cta-band__title text-balance">{withLineBreaks(title)}</h2>
          </div>
          <div className="relative z-[1] flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href={primary.href} variant="soft">
              {primary.label}
            </ButtonLink>
            {secondary ? (
              <ButtonLink href={secondary.href} variant="ink" className="bg-white/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.25)] backdrop-blur-sm hover:bg-white/20">
                {secondary.label}
              </ButtonLink>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
