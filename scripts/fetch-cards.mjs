#!/usr/bin/env node
// Fetches the full Riftbound card list from the official League of Legends card
// gallery and normalizes it into a flat, viewer-friendly cards.json.
//
// The gallery is a Next.js site. We:
//   1. Load the gallery HTML and extract the current Next.js "buildId".
//   2. Request the page's data JSON from /_next/data/<buildId>/.../card-gallery.json
//   3. Walk pageProps to find the card array (its exact path shifts between
//      site builds, so we locate it structurally rather than by a fixed path).
//   4. Flatten each card into the fields the viewer needs.
//
// No API key, no HTML scraping of card details, no third-party dependency.

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const GALLERY_URL = "https://riftbound.leagueoflegends.com/en-us/card-gallery/";
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, "../public/data/cards.json");

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function getJson(url) {
  const res = await fetch(url, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.json();
}

async function getBuildId() {
  const res = await fetch(GALLERY_URL, { headers: { "user-agent": UA } });
  if (!res.ok) throw new Error(`GET gallery -> ${res.status}`);
  const html = await res.text();
  const m = html.match(/"buildId"\s*:\s*"([^"]+)"/);
  if (!m) throw new Error("Could not find Next.js buildId in gallery HTML");
  return m[1];
}

// Recursively find the largest array of card-like objects in the payload.
function findCardArray(root) {
  let best = null;
  const looksLikeCard = (o) =>
    o && typeof o === "object" && "name" in o && "cardImage" in o && "publicCode" in o;
  const walk = (node) => {
    if (Array.isArray(node)) {
      if (node.length && looksLikeCard(node[0]) && (!best || node.length > best.length)) {
        best = node;
      }
      for (const v of node) walk(v);
    } else if (node && typeof node === "object") {
      for (const k of Object.keys(node)) walk(node[k]);
    }
  };
  walk(root);
  return best;
}

const richText = (field) => field?.richText?.body?.trim() || null;
const stripHtml = (html) =>
  html ? html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").trim() : null;

function normalize(card) {
  const ability = richText(card.text);
  const effect = richText(card.effect);
  return {
    id: card.id,
    code: card.publicCode,
    collectorNumber: card.collectorNumber ?? null,
    name: card.name,
    set: card.set?.value?.label ?? null,
    setId: card.set?.value?.id ?? null,
    type: card.cardType?.type?.[0]?.label ?? null,
    rarity: card.rarity?.value?.label ?? null,
    domains: (card.domain?.values || []).map((d) => d.label),
    energy: card.energy?.value?.label ?? null,
    might: card.might?.value?.label ?? null,
    mightBonus: card.mightBonus?.value?.label ?? null,
    power: card.power?.value?.label ?? null,
    tags: card.tags?.tags || [],
    illustrator: (card.illustrator?.values || []).map((i) => i.label).join(", ") || null,
    orientation: card.orientation ?? "portrait",
    image: card.cardImage?.url ?? null,
    // Plain-text rules: prefer the gallery's accessibility text, fall back to ability/effect HTML.
    rulesText:
      stripHtml(card.cardImage?.accessibilityText) ||
      [ability, effect].filter(Boolean).map(stripHtml).join("\n\n") ||
      null,
    abilityHtml: ability,
    effectHtml: effect,
  };
}

async function main() {
  console.error("Resolving build id...");
  const buildId = await getBuildId();
  const dataUrl = `https://riftbound.leagueoflegends.com/_next/data/${buildId}/en-us/card-gallery.json`;
  console.error(`Fetching ${dataUrl}`);
  const data = await getJson(dataUrl);

  const raw = findCardArray(data.pageProps ?? data);
  if (!raw) throw new Error("Could not locate card array in payload (site structure changed?)");

  const cards = raw.map(normalize).sort((a, b) => a.name.localeCompare(b.name));
  const payload = {
    generatedAt: new Date().toISOString(),
    source: GALLERY_URL,
    buildId,
    count: cards.length,
    sets: [...new Set(cards.map((c) => c.set).filter(Boolean))].sort(),
    types: [...new Set(cards.map((c) => c.type).filter(Boolean))].sort(),
    domains: [...new Set(cards.flatMap((c) => c.domains))].sort(),
    rarities: [...new Set(cards.map((c) => c.rarity).filter(Boolean))].sort(),
    cards,
  };

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(payload, null, 2));
  console.error(`Wrote ${cards.length} cards -> ${OUT_PATH}`);
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});
