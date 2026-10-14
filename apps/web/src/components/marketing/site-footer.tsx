import fs from "node:fs";
import path from "node:path";
import Image from "next/image";
import Link from "next/link";
import { Mail } from "lucide-react";
import { resolveNav } from "@/content/nav";
import { SITE } from "@/lib/site";
import { FooterGiant } from "./footer-giant";

/*
 * Kit "column footer + giant wordmark" (home.md §14). Left column: wordmark,
 * tagline, two trust tiles, contact email. Then up to five mono-titled link
 * columns from the registry nav, then the giant "wuup" filled with texture.
 */

const TEXTURE = "/images/footer/wordmark-texture.webp";

let textureExists: boolean | null = null;
function hasTexture() {
  if (textureExists === null) {
    try {
      textureExists = fs.existsSync(path.join(process.cwd(), "public", TEXTURE));
    } catch {
      textureExists = false;
    }
  }
  return textureExists;
}

function ReadOnlyGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M12 3l7 3v5.5c0 4.2-2.9 7.9-7 9.5-4.1-1.6-7-5.3-7-9.5V6l7-3z" />
      <path d="M9 12.2l2.1 2.1L15.2 10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IndiaGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="2" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * Math.PI) / 6;
        return <path key={i} d={`M${12 + 2 * Math.cos(a)} ${12 + 2 * Math.sin(a)}L${12 + 8.5 * Math.cos(a)} ${12 + 8.5 * Math.sin(a)}`} strokeWidth="0.9" />;
      })}
    </svg>
  );
}

export function SiteFooter() {
  const columns = resolveNav().footer.filter((c) => c.links.length > 0);
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <div className="flex flex-col gap-4">
              <Link href="/" aria-label="wuup home" className="w-fit rounded-md">
                <Image src="/brand/wuup-wordmark.svg" alt="wuup" width={126} height={37} unoptimized />
              </Link>
              <p className="text-[12px] leading-[1.5] text-tx-tertiary">
                The read-only AI analyst for MongoDB, Google Sheets and PDFs.
              </p>
              <div className="flex gap-3">
                <div className="trust-tile flex-col gap-1.5 text-tx-secondary" title="Read-only by design">
                  <ReadOnlyGlyph />
                  <span>
                    Read-only
                    <br />
                    by design
                  </span>
                </div>
                <div className="trust-tile flex-col gap-1.5 text-tx-secondary" title="Made in India">
                  <IndiaGlyph />
                  <span>
                    Made in
                    <br />
                    India
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <p className="text-[12px] text-tx-tertiary">Write to us</p>
              <a
                href={`mailto:${SITE.email}`}
                className="inline-flex items-center gap-2 break-all text-[13px] leading-[1.5] text-tx-secondary transition-colors duration-200 hover:text-indigo-800"
              >
                <Mail className="size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                {SITE.email}
              </a>
            </div>
            <div className="footer-legal">
              © {year} wuup. All rights reserved.
              <br />
              <br />
              Built in India by {SITE.founder}.
            </div>
          </div>

          <nav className="footer-cols" aria-label="Footer">
            {columns.map((col) => (
              <div key={col.label} className="footer-col">
                <h2 className="label-mono">{col.label}</h2>
                <ul role="list">
                  {col.links.map((l) => (
                    <li key={l.path}>
                      <Link href={l.path}>{l.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
      </div>
      <div className="container" style={{ width: "92%" }}>
        <FooterGiant texture={hasTexture() ? TEXTURE : undefined} />
      </div>
    </footer>
  );
}
