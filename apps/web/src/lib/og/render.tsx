/**
 * Open Graph image renderer (1200x630 PNG, Node runtime).
 *
 * Background: assets/og/<template>.jpg, else assets/og/default.jpg, else a
 * CSS gradient that mimics the blue sunrise. Fonts are static TTFs in
 * assets/fonts (satori cannot read woff2 or variable fonts).
 * Satori supports flexbox only: every element with children sets display:flex.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import type { OgTemplate } from "@/content/types";

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png";

export interface OgInput {
  template?: OgTemplate;
  eyebrow?: string;
  title: string;
}

const ASSETS = () => path.join(process.cwd(), "assets");

type OgFonts = NonNullable<NonNullable<ConstructorParameters<typeof ImageResponse>[1]>["fonts"]>;

let fontsPromise: Promise<OgFonts> | null = null;

function loadFonts() {
  if (!fontsPromise) {
    const dir = path.join(ASSETS(), "fonts");
    fontsPromise = Promise.all([
      readFile(path.join(dir, "Figtree-Medium.ttf")),
      readFile(path.join(dir, "Figtree-Bold.ttf")),
      readFile(path.join(dir, "Newsreader-Regular.ttf")),
    ]).then(([medium, bold, serif]): OgFonts => [
      { name: "Figtree", data: medium, weight: 500 as const, style: "normal" as const },
      { name: "Figtree", data: bold, weight: 700 as const, style: "normal" as const },
      { name: "Newsreader", data: serif, weight: 400 as const, style: "normal" as const },
    ]);
    fontsPromise.catch(() => {
      fontsPromise = null;
    });
  }
  return fontsPromise;
}

const bgCache = new Map<string, string | null>();

/** data: URL of the template background, falling back to default.jpg, else null. */
async function loadBackground(template: OgTemplate): Promise<string | null> {
  if (bgCache.has(template)) return bgCache.get(template)!;
  const dir = path.join(ASSETS(), "og");
  let result: string | null = null;
  for (const name of [template, "default"]) {
    try {
      const buf = await readFile(path.join(dir, `${name}.jpg`));
      result = `data:image/jpeg;base64,${buf.toString("base64")}`;
      break;
    } catch {
      // try the next candidate
    }
  }
  // Only cache hits in production, so newly generated backgrounds show up in dev.
  if (process.env.NODE_ENV === "production" || result) bgCache.set(template, result);
  return result;
}

const SUNRISE =
  "radial-gradient(ellipse 95% 80% at 50% -12%, #2563EB 0%, #38BDF8 32%, #A5BBFC 58%, #F4F7FF 82%, #fcfcfc 100%)";

/** Title size steps down for long titles so it stays within three lines. */
function titleSize(title: string): number {
  if (title.length <= 60) return 64;
  if (title.length <= 80) return 56;
  return 48;
}

export async function renderOg({ template = "default", eyebrow = "", title }: OgInput): Promise<ImageResponse> {
  const [fonts, bg] = await Promise.all([loadFonts(), loadBackground(template)]);
  const cleanTitle = title.replace(/\s*\n\s*/g, " ").trim();
  const size = titleSize(cleanTitle);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          backgroundColor: "#fcfcfc",
          // Satori chokes on undefined style values, so only set the gradient when needed.
          ...(bg ? {} : { backgroundImage: SUNRISE }),
          fontFamily: "Figtree",
        }}
      >
        {bg ? (
          // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
          <img
            src={bg}
            width={OG_SIZE.width}
            height={OG_SIZE.height}
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : null}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            padding: "64px 80px 56px",
          }}
        >
          {eyebrow ? (
            <div
              style={{
                display: "flex",
                fontFamily: "Figtree",
                fontWeight: 500,
                fontSize: 22,
                color: "#3d3d3d",
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                marginBottom: 20,
              }}
            >
              {eyebrow}
            </div>
          ) : null}
          <div
            style={{
              display: "block",
              fontFamily: "Newsreader",
              fontWeight: 400,
              fontSize: size,
              lineHeight: 1.08,
              letterSpacing: "-0.015em",
              color: "#1f1f1f",
              maxWidth: 960,
              lineClamp: 3,
            }}
          >
            {cleanTitle}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginTop: 48,
              fontFamily: "Figtree",
              fontWeight: 700,
              fontSize: 34,
              letterSpacing: "-0.02em",
              color: "#1f1f1f",
            }}
          >
            wuup
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts }
  );
}
