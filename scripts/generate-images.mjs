#!/usr/bin/env node
// Generates the wuup marketing imagery defined in scripts/image-manifest.mjs.
//
// Usage (from the repo root):
//   node --env-file=.env.local scripts/generate-images.mjs [--only=id[,id]] [--force] [--dry-run]
//        [--provider=openai|gemini] [--reprocess] [--raw-dir=path]
//
//   --only       exact slot id, or a group prefix such as "guides/" (comma separated)
//   --force      regenerate even if the output file exists
//   --dry-run    print what would happen, no API calls, no writes
//   --provider   use only this provider
//   --reprocess  rebuild outputs from the cached raw image (no API call)
//   --raw-dir    where raw model outputs are cached (default: $TMPDIR/wuup-image-raw)
//
// Keys come from GEMINI_API_KEY and OPENAI_API_KEY. They are never logged.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { GLOBAL_STYLE, SLOTS } from './image-manifest.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOG_PATH = path.join(ROOT, 'scripts/image-log.json');

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const FORCE = !!args.force;
const DRY = !!args['dry-run'];
const REPROCESS = !!args.reprocess;
const ONLY = typeof args.only === 'string' ? args.only.split(',').filter(Boolean) : null;
const PROVIDER = typeof args.provider === 'string' ? args.provider : null;
const RAW_DIR = typeof args['raw-dir'] === 'string' ? path.resolve(args['raw-dir']) : path.join(os.tmpdir(), 'wuup-image-raw');
const CONCURRENCY = 2;

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_MODELS = ['gemini-nano-banana-2.1'];
const OPENAI_MODELS = ['gpt-image-2.5-flare', 'gpt-image-2', 'gpt-image-1.5'];

// ---------------------------------------------------------------- helpers

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const scrub = (s) => {
  let out = String(s);
  for (const k of [GEMINI_KEY, OPENAI_KEY]) if (k) out = out.split(k).join('<redacted>');
  return out.slice(0, 600);
};

class HttpError extends Error {
  constructor(status, body) {
    super(`HTTP ${status}: ${scrub(body)}`);
    this.status = status;
  }
}

// fetch JSON with exponential backoff on 429, 5xx and network errors
async function fetchJson(url, init, label) {
  const max = 6;
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(url, { ...init, signal: AbortSignal.timeout(300_000) });
    } catch (err) {
      if (attempt >= max) throw err;
      const wait = 2000 * 2 ** attempt + Math.random() * 1000;
      console.warn(`  ${label}: network error (${err.message}), retry in ${Math.round(wait / 1000)}s`);
      await sleep(wait);
      continue;
    }
    if (res.ok) return res.json();
    const body = await res.text();
    if ((res.status === 429 || res.status >= 500) && attempt < max) {
      const ra = Number(res.headers.get('retry-after'));
      const wait = ra > 0 ? ra * 1000 : 2000 * 2 ** attempt + Math.random() * 1000;
      console.warn(`  ${label}: HTTP ${res.status}, retry in ${Math.round(wait / 1000)}s`);
      await sleep(wait);
      continue;
    }
    throw new HttpError(res.status, body);
  }
}

function buildPrompt(slot) {
  return slot.noGlobal ? slot.prompt : `${GLOBAL_STYLE}\n\n${slot.prompt}`;
}

async function loadRefs(slot) {
  const refs = [];
  for (const id of slot.refs ?? []) {
    const ref = SLOTS.find((s) => s.id === id);
    if (!ref || ref.id === slot.id) continue;
    const file = path.join(ROOT, ref.out);
    if (!fs.existsSync(file)) continue;
    const buf = await sharp(file).resize({ width: 1024 }).jpeg({ quality: 85 }).toBuffer();
    refs.push({ mime: 'image/jpeg', data: buf.toString('base64') });
  }
  return refs;
}

// ---------------------------------------------------------------- Gemini

let geminiModelCache = null;
async function geminiModels() {
  if (geminiModelCache) return geminiModelCache;
  const j = await fetchJson(`${GEMINI_BASE}/models?pageSize=200`, { headers: { 'x-goog-api-key': GEMINI_KEY } }, 'gemini list');
  const names = (j.models ?? [])
    .filter((m) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''))
    .filter((n) => /image|banana/i.test(n) && !/lite/i.test(n));
  // prefer nano-banana, then newest version number, stable over preview
  const ver = (n) => Number((n.match(/(\d+(?:\.\d+)?)/) ?? [0, 0])[1]);
  names.sort((a, b) => (/banana/.test(b) - /banana/.test(a)) || ver(b) - ver(a) || (/preview/.test(a) - /preview/.test(b)));
  geminiModelCache = [...new Set([...GEMINI_MODELS, ...names])];
  return geminiModelCache;
}

async function geminiInteractions(model, prompt, slot, refs) {
  const input = refs.length
    ? [{ type: 'text', text: `Use the reference image(s) only for rendering style: palette, nested contour layering, grain and lighting. Do NOT copy the reference's shape or silhouette; draw the new motif described below.\n\n${prompt}` },
       ...refs.map((r) => ({ type: 'image', data: r.data, mime_type: r.mime }))]
    : prompt;
  const j = await fetchJson(`${GEMINI_BASE}/interactions`, {
    method: 'POST',
    headers: { 'x-goog-api-key': GEMINI_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      input,
      // the Interactions API only accepts image/jpeg here; we re-encode afterwards
      response_format: { type: 'image', mime_type: 'image/jpeg', aspect_ratio: slot.aspect, image_size: '2K' },
    }),
  }, `gemini interactions ${slot.id}`);
  for (const step of j.steps ?? []) {
    for (const c of step.content ?? []) if (c.type === 'image' && c.data) return Buffer.from(c.data, 'base64');
  }
  if (j.output_image?.data) return Buffer.from(j.output_image.data, 'base64');
  throw new Error('interactions: no image in response');
}

async function geminiGenerateContent(model, prompt, slot, refs) {
  const parts = [{ text: refs.length ? `Use the reference image(s) only for rendering style: palette, nested contour layering, grain and lighting. Do NOT copy the reference's shape or silhouette; draw the new motif described below.\n\n${prompt}` : prompt }];
  for (const r of refs) parts.push({ inlineData: { mimeType: r.mime, data: r.data } });
  const j = await fetchJson(`${GEMINI_BASE}/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': GEMINI_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: slot.aspect, imageSize: '2K' } },
    }),
  }, `gemini generateContent ${slot.id}`);
  for (const p of j.candidates?.[0]?.content?.parts ?? []) {
    if (p.inlineData?.data) return Buffer.from(p.inlineData.data, 'base64');
  }
  throw new Error(`generateContent: no image (finishReason ${j.candidates?.[0]?.finishReason ?? 'n/a'})`);
}

async function generateGemini(slot) {
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY missing');
  const prompt = buildPrompt(slot);
  const refs = await loadRefs(slot);
  const models = await geminiModels();
  let lastErr;
  for (const model of models.slice(0, 3)) {
    for (const [name, fn] of [['interactions', geminiInteractions], ['generateContent', geminiGenerateContent]]) {
      try {
        const buf = await fn(model, prompt, slot, refs);
        return { buf, provider: 'gemini', model, api: name, refs: refs.length };
      } catch (err) {
        lastErr = err;
        console.warn(`  ${slot.id}: gemini ${name} ${model} failed: ${err.message}`);
        if (err.status === 404) break; // unknown model: try the next one
      }
    }
  }
  throw lastErr ?? new Error('gemini: no model worked');
}

// ---------------------------------------------------------------- OpenAI

function openaiSize(aspect) {
  const [w, h] = aspect.split(':').map(Number);
  const r = w / h;
  if (r > 1.2) return '1536x1024';
  if (r < 0.83) return '1024x1536';
  return '1024x1024';
}

let openaiWorkingModel = null;
async function generateOpenAI(slot) {
  if (!OPENAI_KEY) throw new Error('OPENAI_API_KEY missing');
  const prompt = buildPrompt(slot);
  const models = openaiWorkingModel ? [openaiWorkingModel] : OPENAI_MODELS;
  let lastErr;
  for (const model of models) {
    try {
      const j = await fetchJson('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { authorization: `Bearer ${OPENAI_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          size: openaiSize(slot.aspect),
          quality: 'high',
          background: slot.transparent ? 'transparent' : 'opaque',
          output_format: 'png',
        }),
      }, `openai ${slot.id}`);
      const b64 = j.data?.[0]?.b64_json;
      if (!b64) throw new Error('openai: no b64_json');
      openaiWorkingModel = model;
      return { buf: Buffer.from(b64, 'base64'), provider: 'openai', model, api: 'images/generations', refs: 0 };
    } catch (err) {
      lastErr = err;
      console.warn(`  ${slot.id}: openai ${model} failed: ${err.message}`);
      if (!(err.status === 400 || err.status === 404 || err.status === 403)) break;
    }
  }
  throw lastErr;
}

// ---------------------------------------------------------------- post-processing

// Steps quality down until the file fits maxKB. Very detailed images (photo
// textures) that do not fit at a decent quality get a gentle blur first, which
// compresses far better than dropping to a blocky low quality.
const ENCODE_PASSES = [
  { blur: 0, minQ: 50 },
  { blur: 0.6, minQ: 50 },
  { blur: 1.0, minQ: 45 },
  { blur: 1.6, minQ: 40 },
  { blur: 0, minQ: 30 },
];

async function encode(pipelineFactory, slot) {
  const ext = path.extname(slot.out).toLowerCase();
  const max = (slot.maxKB ?? 200) * 1024;
  let buf;
  for (const { blur, minQ } of ENCODE_PASSES) {
    for (let q = ext === '.jpg' ? 80 : 78; q >= minQ; q -= 4) {
      let p = pipelineFactory();
      if (blur) p = p.blur(blur);
      buf = ext === '.jpg'
        ? await p.flatten({ background: '#f4f7ff' }).jpeg({ quality: q, mozjpeg: true }).toBuffer()
        : await p.webp({ quality: q, alphaQuality: 90, effort: 6, smartSubsample: true }).toBuffer();
      if (buf.length <= max) return { buf, quality: blur ? `${q} blur${blur}` : q };
    }
  }
  return { buf, quality: 30, overBudget: true };
}

function cropPosition(slot) {
  if (!slot.position || slot.position === 'attention') return sharp.strategy.attention;
  return slot.position;
}

async function postProcess(raw, slot) {
  return encode(
    () => sharp(raw).resize(slot.width, slot.height, { fit: 'cover', position: cropPosition(slot) }),
    slot,
  );
}

// ---------------------------------------------------------------- log

function appendLog(entry) {
  let log = [];
  try { log = JSON.parse(fs.readFileSync(LOG_PATH, 'utf8')); } catch {}
  log.push(entry);
  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2) + '\n');
}

// ---------------------------------------------------------------- run

const rawPath = (slot) => path.join(RAW_DIR, `${slot.id.replace(/\//g, '__')}.bin`);

async function runSlot(slot) {
  const out = path.join(ROOT, slot.out);
  if (fs.existsSync(out) && !FORCE && !REPROCESS) {
    console.log(`skip  ${slot.id} (exists)`);
    return { id: slot.id, status: 'skipped' };
  }

  if (slot.derive) {
    const src = SLOTS.find((s) => s.id === slot.derive.from);
    const srcFile = src && path.join(ROOT, src.out);
    if (DRY) { console.log(`dry   ${slot.id}: derive from ${slot.derive.from}`); return { id: slot.id, status: 'dry' }; }
    if (!srcFile || !fs.existsSync(srcFile)) throw new Error(`derive source missing: ${slot.derive.from}`);
    const { hue = 0, saturation = 1, brightness = 1 } = slot.derive;
    const { buf, quality } = await encode(
      () => sharp(srcFile).resize(slot.width, slot.height, { fit: 'cover' }).modulate({ hue, saturation, brightness }),
      slot,
    );
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, buf);
    console.log(`ok    ${slot.id} derived from ${slot.derive.from} (${Math.round(buf.length / 1024)}KB q${quality})`);
    appendLog({ id: slot.id, provider: 'derived', model: slot.derive.from, prompt: `tint ${JSON.stringify(slot.derive)}`, date: new Date().toISOString(), bytes: buf.length });
    return { id: slot.id, status: 'ok' };
  }

  const order = PROVIDER ? [PROVIDER] : slot.transparent ? ['openai', 'gemini'] : ['gemini', 'openai'];
  if (DRY) {
    console.log(`dry   ${slot.id} -> ${slot.out} ${slot.width}x${slot.height} <=${slot.maxKB}KB aspect ${slot.aspect} providers ${order.join(',')}${slot.refs ? ` refs ${slot.refs.join(',')}` : ''}`);
    console.log(`      ${buildPrompt(slot).replace(/\n+/g, ' ').slice(0, 220)}...`);
    return { id: slot.id, status: 'dry' };
  }

  let gen;
  if (REPROCESS) {
    if (!fs.existsSync(rawPath(slot))) throw new Error('no cached raw image to reprocess');
    gen = { buf: fs.readFileSync(rawPath(slot)), provider: 'cache', model: 'cache' };
  } else {
    let lastErr;
    for (const p of order) {
      if (slot.transparent && p === 'gemini') console.warn(`  ${slot.id}: falling back to gemini, alpha will be lost`);
      try {
        gen = p === 'openai' ? await generateOpenAI(slot) : await generateGemini(slot);
        break;
      } catch (err) {
        lastErr = err;
      }
    }
    if (!gen) throw lastErr;
    fs.mkdirSync(RAW_DIR, { recursive: true });
    fs.writeFileSync(rawPath(slot), gen.buf);
  }

  const { buf, quality, overBudget } = await postProcess(gen.buf, slot);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, buf);
  console.log(`ok    ${slot.id} via ${gen.provider}/${gen.model}${gen.api ? ` (${gen.api})` : ''} ${Math.round(buf.length / 1024)}KB q${quality}${overBudget ? ' OVER BUDGET' : ''}`);
  if (!REPROCESS) {
    appendLog({ id: slot.id, provider: gen.provider, model: gen.model, prompt: buildPrompt(slot), date: new Date().toISOString(), bytes: buf.length });
  }
  return { id: slot.id, status: 'ok' };
}

async function pool(items, n, fn) {
  const results = [];
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const item = items[i++];
      try { results.push(await fn(item)); }
      catch (err) {
        console.error(`FAIL  ${item.id}: ${scrub(err.message)}`);
        results.push({ id: item.id, status: 'failed', error: scrub(err.message) });
      }
    }
  }));
  return results;
}

const selected = SLOTS.filter((s) => !ONLY || ONLY.some((o) => s.id === o || (o.endsWith('/') && s.id.startsWith(o))));
if (!selected.length) {
  console.error(`no slot matches --only=${args.only}`);
  process.exit(1);
}

// phases: plain slots, then slots that use references, then derived ones
const phases = [
  selected.filter((s) => !s.refs && !s.derive),
  selected.filter((s) => s.refs && !s.derive),
  selected.filter((s) => s.derive),
];
const all = [];
for (const phase of phases) all.push(...(await pool(phase, CONCURRENCY, runSlot)));

const failed = all.filter((r) => r.status === 'failed');
console.log(`\n${all.filter((r) => r.status === 'ok').length} generated, ${all.filter((r) => r.status === 'skipped').length} skipped, ${failed.length} failed`);
if (failed.length) process.exitCode = 1;
