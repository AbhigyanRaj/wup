// Image slots for the wuup marketing site.
// Consumed by scripts/generate-images.mjs. Paths are relative to the repo root.
//
// Slot fields:
//   id        unique id, used with --only=<id> (prefix match on "group/")
//   out       output path (extension decides the encoder: .webp or .jpg)
//   width, height, maxKB
//   aspect    aspect ratio requested from the model (Gemini values)
//   prompt    slot prompt (GLOBAL_STYLE is prepended automatically)
//   transparent  true: OpenAI first with background "transparent", alpha kept
//   position  sharp crop position (default "attention")
//   refs      ids of already generated slots passed as style references
//   derive    { from: id, hue, brightness, saturation } builds the output from
//             another slot's file with a tint shift, no API call

export const GLOBAL_STYLE =
  'Soft, luminous, minimal digital illustration. Cool blue palette only: royal blue #2563EB, sky blue #38BDF8, ' +
  'periwinkle #A5BBFC, indigo #556ADC, deep navy #172554, ice white #F4F7FF. Smooth gradients with subtle film grain. ' +
  'Rounded, symmetric geometric forms with thin white line-art details. Calm, premium, generous negative space. ' +
  'Strictly no orange, red, yellow, green or warm tones. No text, letters, numbers, logos, watermarks, user interface or people.';

const IMG = 'apps/web/public/images';
const OG = 'apps/web/assets/og';

const COVER_STYLE =
  'Bold editorial cover illustration. One large symmetric abstract shape, centred, filling about 70% of the frame with ' +
  'generous even padding, rendered as a matte soft-gradient form with three to five nested inner contour layers, each ' +
  'slightly lighter toward the centre, and a few thin white line-art accents. Flat, calm background in the same two-tone ' +
  'gradient. The centre of the shape is calm, smooth and empty so a title can be overlaid later. Subtle film grain. ' +
  'Absolutely no text or letters.';

const PALETTES = {
  mongodb: 'Two-tone gradient from royal blue #2563EB to sky blue #38BDF8.',
  sheets: 'Two-tone gradient from sky blue #38BDF8 to periwinkle #A5BBFC.',
  docs: 'Two-tone gradient from indigo #556ADC to periwinkle #A5BBFC.',
  safety: 'Two-tone gradient from deep navy #172554 to royal blue #2563EB.',
  compare: 'Two-tone gradient from periwinkle #A5BBFC to ice white #F4F7FF, with indigo #556ADC accents.',
};

const cover = (group, slug, palette, motif, refs) => ({
  id: `${group}/${slug}`,
  out: `${IMG}/${group}/${slug}.webp`,
  width: 1600,
  height: 900,
  maxKB: 180,
  aspect: '16:9',
  position: 'centre',
  prompt: `${COVER_STYLE} ${PALETTES[palette]} Motif: ${motif}. 16:9 landscape.`,
  refs,
});

const pillar = (slug, field, glyph) => ({
  id: `home/pillar-${slug}`,
  out: `${IMG}/home/pillar-${slug}.webp`,
  width: 1104,
  height: 660,
  maxKB: 120,
  aspect: '16:9',
  position: 'centre',
  prompt:
    `A single saturated ${field} gradient field filling the whole frame, smooth and evenly lit, symmetric left to right, no dark corners or blotches, ` +
    `with faint thin concentric curved lines in white at low opacity radiating from the centre. ` +
    `Exactly centred, upright and front-facing, small enough to leave wide margins: ${glyph}. Soft inner glow, gentle soft shadow beneath. Wide 5:3 composition.`,
});

const tile = (slug, colour, emblem) => ({
  id: `home/tile-${slug}`,
  out: `${IMG}/home/tile-${slug}.webp`,
  width: 320,
  height: 320,
  maxKB: 40,
  aspect: '1:1',
  transparent: true,
  position: 'centre',
  prompt:
    `A single app-icon style rounded square made of frosted glass with glossy depth, filled with a ${colour} gradient, ` +
    `with a subtle embossed white ${emblem} in the centre, soft drop shadow beneath. Isolated object centred on a fully transparent background, ` +
    'the rounded square fills about 80% of the canvas. 1:1.',
});

const plan = (slug, gradient, emblem) => ({
  id: `pricing/plan-${slug}`,
  out: `${IMG}/pricing/plan-${slug}.webp`,
  width: 1752,
  height: 768,
  maxKB: 150,
  aspect: '21:9',
  position: 'centre',
  prompt:
    `A wide banner: a smooth ${gradient} gradient filling the frame, with faint thin white concentric elliptical lines centred on the middle. ` +
    `Centred, modest in size with wide empty margins: a frosted translucent white ${emblem}, soft inner glow. Ultra-wide composition.`,
});

const mat = (slug, colour) => ({
  id: `mats/${slug}`,
  out: `${IMG}/mats/${slug}.webp`,
  width: 1624,
  height: 812,
  maxKB: 90,
  aspect: '16:9',
  position: 'centre',
  // no global style here: its "geometric forms" wording makes the model draw an illustration
  noGlobal: true,
  prompt:
    `Texture swatch only. A completely flat, evenly inked risograph print of a single solid ${colour} ink colour on paper, ` +
    'filling the entire frame edge to edge, with fine subtle grain, gentle speckle noise and very slight tonal mottling. ' +
    'An empty, plain colour field: no objects, no illustration, no shapes, no lines, no borders, no gradient bands, no text, ' +
    'no warm tones. Full-bleed abstract background texture.',
});

const OG_BASE =
  'A wide social card background, pure soft light and colour. A very wide, extremely blurred sunrise half-disc hanging down from the top edge, ' +
  'centred horizontally and spanning about 80% of the frame width, its edges dissolving softly like out-of-focus light, no hard edges: ' +
  'a royal blue #2563EB core fading outward to sky blue #38BDF8, then periwinkle #A5BBFC, then ice white #F4F7FF. The glow occupies only ' +
  'the top 35% of the frame. The lower 65% of the frame, especially the lower-left area, is calm, almost flat, very light ice white #F4F7FF ' +
  'with fine film grain. No rings, no lines, no circles, no objects, no shapes, no dark navy.';

const og = (slug, tint) => ({
  id: `og/${slug}`,
  out: `${OG}/${slug}.jpg`,
  width: 1200,
  height: 630,
  maxKB: 120,
  aspect: '16:9',
  position: 'north',
  prompt: `${OG_BASE} ${tint} Wide 1.9:1 composition.`,
});

const ogDerived = (slug, from, tint) => ({
  id: `og/${slug}`,
  out: `${OG}/${slug}.jpg`,
  width: 1200,
  height: 630,
  maxKB: 120,
  derive: { from: `og/${from}`, ...tint },
});

const UC_REF = ['use-cases/product-analytics-mongodb'];
const GUIDE_REF = ['guides/query-mongodb-in-plain-english'];

export const SLOTS = [
  // ---------- home ----------
  {
    id: 'home/split-security',
    out: `${IMG}/home/split-security.webp`,
    width: 1080,
    height: 816,
    maxKB: 160,
    aspect: '4:3',
    position: 'centre',
    prompt:
      'A serene, perfectly mirror-symmetric scene. A soft periwinkle-to-ice-white gradient sky. Three overlapping layers of smooth ' +
      'semicircular hemisphere domes, perfectly round on top with no points, spires or tips, in indigo and royal blue, rising from the ' +
      'bottom edge like a calm modern vault, flat-shaded with soft inner glows. A thin white geometric lattice shield (a hexagonal ' +
      'grid inside a rounded shield outline), drawn in fine monoline, floating in the sky above the domes. 4:3.',
  },
  pillar('mongodb', 'royal blue #2563EB to sky blue #38BDF8',
    'a white translucent glossy stack of three rounded discs, like a database cylinder'),
  pillar('sheets', 'sky blue #38BDF8 to periwinkle #A5BBFC',
    'a frosted translucent white rounded grid of nine soft square cells, three by three'),
  pillar('docs', 'indigo #556ADC to periwinkle #A5BBFC',
    'a frosted translucent white stack of three rounded rectangular paper pages standing upright, seen straight on, with a small white ribbon bookmark hanging from the top edge'),
  tile('sandbox', 'royal blue #2563EB', 'cube'),
  tile('connect', 'sky blue #38BDF8', 'pair of linked rings'),
  tile('upload', 'indigo #556ADC', 'page with an upward chevron'),

  // ---------- pricing ----------
  plan('free', 'periwinkle #A5BBFC to ice white #F4F7FF', 'sprouting four-point spark'),
  plan('byok', 'deep navy #172554 to royal blue #2563EB', 'rounded key built from overlapping circles'),

  // ---------- mats ----------
  mat('blue', 'royal blue #2563EB'),
  mat('sky', 'sky blue #38BDF8'),
  mat('indigo', 'indigo #556ADC'),
  mat('periwinkle', 'periwinkle #A5BBFC'),

  // ---------- use-case covers ----------
  cover('use-cases', 'product-analytics-mongodb', 'mongodb', 'a symmetric row of rising rounded bar arches, tallest in the middle'),
  cover('use-cases', 'ecommerce-orders-mongodb', 'mongodb', 'one simple basket silhouette: a wide rounded bowl shape with a single tall rounded arch handle above it, the handle drawn as three nested arch contours; no circles, no extra elements', UC_REF),
  cover('use-cases', 'support-tickets-mongodb', 'docs', 'two interlocking rounded speech rings', UC_REF),
  cover('use-cases', 'sales-pipeline-google-sheets', 'sheets', 'a stepped funnel arch narrowing downward in rounded tiers', UC_REF),
  cover('use-cases', 'finance-reporting-google-sheets', 'sheets', 'a balanced scale made of soft discs, perfectly level', UC_REF),
  cover('use-cases', 'research-pdfs-and-spreadsheets', 'docs', 'an open book seen from the front with a soft grid halo behind it', UC_REF),

  // ---------- guide covers ----------
  cover('guides', 'query-mongodb-in-plain-english', 'mongodb', 'a nested speech-bubble arch'),
  cover('guides', 'mongodb-aggregation-pipeline-examples', 'mongodb', 'a vertical chain of rounded capsules connected end to end', GUIDE_REF),
  cover('guides', 'mongodb-read-only-user', 'safety', 'a classic heraldic shield silhouette (flat top, curved sides meeting in a point at the bottom) standing inside a larger scalloped arch frame with small lobes along its edge', GUIDE_REF),
  cover('guides', 'connect-mongodb-to-chatgpt-or-claude', 'mongodb', 'two mirrored arches joined by a gentle bridge between them', GUIDE_REF),
  cover('guides', 'sql-to-mongodb-cheat-sheet', 'compare', 'square grid tiles on the left gradually morphing into leaf-shaped ovals on the right', GUIDE_REF),
  cover('guides', 'chat-with-google-sheets-methods', 'sheets', 'a scalloped frame around a grid of soft rounded cells', GUIDE_REF),
  cover('guides', 'ask-questions-across-pdfs-and-spreadsheets', 'docs', 'a neat fanned stack of four rounded rectangular paper sheets, slightly offset, with a column of small circular markers along the right edge of the top sheet', GUIDE_REF),
  cover('guides', 'why-ai-data-answers-hallucinate', 'docs', 'a soft blurred orb on the left sharpening into a crisp ringed sphere on the right', GUIDE_REF),
  cover('guides', 'text-to-sql-vs-text-to-mongodb', 'compare', 'two separate standalone shapes side by side with clear empty space between them: on the left an arch filled with a fine square grid, on the right a pointed leaf-shaped arch with a central vein', GUIDE_REF),
  cover('guides', 'best-ai-data-analyst-tools', 'compare', 'a perfectly mirror-symmetric constellation: six identical rounded capsules evenly spaced on an orbit around a central ring, connected to it by thin white lines', GUIDE_REF),
  cover('guides', 'byok-explained', 'safety', 'a key made of overlapping circles', GUIDE_REF),
  cover('guides', 'is-it-safe-to-connect-database-to-ai', 'safety', 'a round vault door seen face-on: perfectly circular concentric rings, a small solid circular hub in the centre, and evenly spaced short bolt notches around the outer ring', GUIDE_REF),
  cover('guides', 'infer-mongodb-schema-from-documents', 'mongodb', 'scattered dots organising into a symmetric branching line tree', GUIDE_REF),

  // ---------- footer ----------
  {
    id: 'footer/wordmark-texture',
    out: `${IMG}/footer/wordmark-texture.webp`,
    width: 3200,
    height: 500,
    maxKB: 70,
    aspect: '21:9',
    position: 'centre',
    noGlobal: true,
    prompt:
      'Macro close-up photograph of flowing liquid glass and finely woven silk threads in sapphire, cobalt, sky blue and periwinkle. ' +
      'Soft natural light, shallow depth of field, rich but calm cool tones, the texture fills the entire frame edge to edge. ' +
      'Strictly no warm tones, no text, no logos, no people. Ultra-wide.',
  },

  // ---------- OG backgrounds (4 generated, 6 derived with a tint shift) ----------
  og('default', 'Balanced, neutral blue.'),
  og('guide', 'The core leans slightly toward indigo #556ADC.'),
  og('tool', 'The core leans slightly toward sky blue #38BDF8, a touch brighter.'),
  og('docs', 'The core leans slightly toward periwinkle #A5BBFC, softer and paler.'),
  ogDerived('compare', 'guide', { hue: -6 }),
  ogDerived('connector', 'tool', { hue: -6 }),
  ogDerived('use-case', 'default', { hue: -8, saturation: 1.05 }),
  ogDerived('feature', 'default', { hue: 6 }),
  ogDerived('legal', 'docs', { saturation: 0.85, brightness: 1.01 }),
  ogDerived('glossary', 'docs', { hue: -10, saturation: 0.95 }),
];
