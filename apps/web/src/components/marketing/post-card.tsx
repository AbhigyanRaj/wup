import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";

/*
 * Kit post card (blogs 2.4): no card box, the 16:9 image is the card.
 * Thumb radius 8 with a #f0f0f0 hairline (#e6e6e6 + image scale 1.02 on hover),
 * then 16px below: 14px meta "date · tag" and an 18px/525 two-line title.
 * The cover art carries the short title in HTML (Newsreader, white), centred
 * in the calm middle of the generated art.
 */

export interface PostCardProps {
  href: string;
  title: string;
  /** Short name set on the cover art. */
  coverLabel: string;
  /** /images/guides/<slug>.webp, or null for the gradient fallback. */
  cover?: string | null;
  meta?: string[];
  /** Eyebrow shown on fallback covers (e.g. "Free tool"). */
  eyebrow?: string;
  headingLevel?: "h2" | "h3";
  sizes?: string;
  preload?: boolean;
  className?: string;
}

export function CoverArt({
  src,
  label,
  eyebrow,
  sizes,
  preload,
  size = "md",
  className,
}: {
  src?: string | null;
  label: string;
  eyebrow?: string;
  sizes: string;
  preload?: boolean;
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <div className={cn("cover-art", `cover-art--${size}`, !src && "cover-art--fallback", className)}>
      {src ? (
        <Image
          src={src}
          alt=""
          fill
          sizes={sizes}
          quality={80}
          className="cover-art__img"
          {...(preload ? { preload: true, fetchPriority: "high" as const } : { loading: "lazy" as const })}
        />
      ) : (
        <span className="cover-art__glow" aria-hidden="true" />
      )}
      <span className="cover-art__scrim" aria-hidden="true" />
      <span className="cover-art__label" aria-hidden="true">
        {!src && eyebrow ? <span className="cover-art__eyebrow">{eyebrow}</span> : null}
        <span className="cover-art__title">{label}</span>
      </span>
    </div>
  );
}

export function PostCard({
  href,
  title,
  coverLabel,
  cover,
  meta = [],
  eyebrow,
  headingLevel = "h3",
  sizes = "(min-width: 1024px) 25vw, (min-width: 640px) 44vw, 88vw",
  preload,
  className,
}: PostCardProps) {
  const H = headingLevel;
  return (
    <Link href={href} className={cn("post-card group", className)}>
      <div className="post-card__media relative">
        <CoverArt src={cover} label={coverLabel} eyebrow={eyebrow} sizes={sizes} preload={preload} />
      </div>
      <div className="flex flex-col gap-2">
        {meta.length ? (
          <p className="flex flex-wrap items-center gap-2 text-caption text-tx-tertiary">
            {meta.map((m, i) => (
              <span key={`${m}-${i}`} className="flex items-center gap-2">
                {i > 0 ? <span aria-hidden="true">·</span> : null}
                {m}
              </span>
            ))}
          </p>
        ) : null}
        <H className="post-card__title transition-colors duration-200 group-hover:text-indigo-800">{title}</H>
      </div>
    </Link>
  );
}
