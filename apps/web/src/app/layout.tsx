import { DM_Mono, Figtree, Newsreader } from "next/font/google";
import { rootMetadata, rootViewport } from "@/lib/seo";
import "./globals.css";

/*
 * Fonts. Each exposes a CSS variable consumed by src/styles/tokens.css and the
 * Tailwind theme (font-sans / font-display / font-mono).
 * Figtree loads as a variable font (no `weight`), so the kit's 425 / 525 weights
 * are applied in CSS. Passing custom weights like "425" to next/font throws.
 */
const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  axes: ["opsz"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});

export const metadata = rootMetadata;
export const viewport = rootViewport;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${figtree.variable} ${newsreader.variable} ${dmMono.variable}`}>
      <body className="bg-bg text-tx font-sans antialiased">{children}</body>
    </html>
  );
}
