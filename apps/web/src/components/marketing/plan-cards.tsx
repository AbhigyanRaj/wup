import Image from "next/image";
import type { PricingTier } from "@/content/types";
import { ButtonLink } from "@/components/ui/button";
import { CheckBadgeIcon } from "@/components/ui/checklist";
import { cn } from "@/lib/cn";

/*
 * Plan cards (kit pricing.md 2.2): two image-topped white cards, 900px wide
 * together. 192px gradient header art (160px mobile), then eyebrow (plan
 * name), 24px title, description, an ink pill and a hairline-topped list of
 * benefits with outlined indigo badge checks.
 */

export interface PlanCard extends PricingTier {
  image: { src: string; alt: string };
  /** Small line under the CTA, e.g. "No card needed". */
  note?: string;
  /** Second, quieter action. */
  secondary?: { label: string; href: string };
}

export function PlanCards({ plans, className }: { plans: PlanCard[]; className?: string }) {
  return (
    <div className={cn("mx-auto grid w-full items-stretch gap-4 md:w-9/12 md:grid-cols-2 md:gap-6", className)}>
      {plans.map((plan) => (
        <article
          key={plan.id}
          className="flex flex-col overflow-hidden rounded-card border border-st-secondary bg-sf-white"
        >
          <div className="relative h-40 overflow-hidden [background:var(--gradient-blue-light)] md:h-48">
            <Image
              src={plan.image.src}
              alt={plan.image.alt}
              fill
              sizes="(min-width: 1536px) 520px, (min-width: 768px) 38vw, 88vw"
              className="object-cover"
              loading="eager"
            />
          </div>
          <div className="flex flex-1 flex-col gap-6 p-6 md:p-8">
            <div className="flex flex-col gap-2">
              <p className="text-caption font-medium leading-5 text-tx-tertiary">{plan.name}</p>
              <h3 className="text-heading-card font-medium leading-8 tracking-[-0.02em] text-tx md:text-heading-3">
                {plan.price}
              </h3>
              <p className="text-caption leading-[1.65] text-tx-secondary md:text-body">{plan.summary}</p>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <ButtonLink href={plan.cta.href} variant="ink" className="w-fit">
                {plan.cta.label}
              </ButtonLink>
              {plan.secondary ? (
                <ButtonLink href={plan.secondary.href} variant="soft" className="w-fit">
                  {plan.secondary.label}
                </ButtonLink>
              ) : null}
              {plan.note ? <span className="text-caption text-tx-tertiary">{plan.note}</span> : null}
            </div>
            <ul className="m-0 flex list-none flex-col gap-3 border-t border-st-secondary p-0 pt-6">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-caption text-tx md:text-body">
                  <span className="relative size-[18px] shrink-0 text-indigo-600">
                    <CheckBadgeIcon className="size-[18px] opacity-[0.14]" />
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="absolute inset-0 size-[18px]"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.6}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    >
                      <path d="M12 2l2.4 2.1 3.2-.3.9 3.1 2.8 1.6-1 3 1 3-2.8 1.6-.9 3.1-3.2-.3L12 22l-2.4-2.1-3.2.3-.9-3.1-2.8-1.6 1-3-1-3 2.8-1.6.9-3.1 3.2.3z" />
                      <path d="M8.6 12.2l2.3 2.2 4.6-4.8" />
                    </svg>
                  </span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </article>
      ))}
    </div>
  );
}
