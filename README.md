# Riftbound Offline Card DB

An offline-capable PWA for browsing every Riftbound TCG card. Card text/stats
work fully offline out of the box; card images are downloaded on demand.

## Quick start

```bash
npm run fetch    # pull latest cards from the official gallery -> public/data/cards.json
npm run serve    # serve at http://localhost:8080
# or just: npm start  (fetch + serve)
```

Open <http://localhost:8080>. To use it as an installable app, click the
browser's "Install" / "Add to Home Screen" prompt.

## How it works

- **Data** — `scripts/fetch-cards.mjs` reads the official gallery
  (`riftbound.leagueoflegends.com/en-us/card-gallery/`). It extracts the
  Next.js `buildId`, requests the page's data JSON, locates the card array, and
  writes a flattened `public/data/cards.json` (~950 cards: name, code, set,
  type, rarity, domains, energy/might/power, tags, plain-text rules, image URL).
  No API key, no HTML scraping of card details, no dependencies.
- **Viewer** — `public/` is a single-page app (no build step, no framework):
  a card grid with fuzzy search and set/type/domain/rarity filters, plus a
  detail modal.
- **Offline** — `sw.js` precaches the app shell + `cards.json`, so text and
  search work with no network. Images are **not** bundled by default:
  - Online, thumbnails load from the CDN and are cached as you view them.
  - Click **"Download images for offline"** to pre-fetch all ~950 images into
    the image cache for true offline browsing (a few hundred MB).
- **Freshness** — when online, the app compares its stored `buildId` against the
  live gallery and shows "Update available" if the official data has changed
  (e.g. errata or a new set). Re-run `npm run fetch` to update.

## Auto-refresh

`.github/workflows/refresh-cards.yml` re-runs the fetch every Monday 06:00 UTC
(and on manual dispatch) and commits `cards.json` if anything changed. If you
deploy `public/` (GitHub Pages, Netlify, etc.), updates flow automatically.

## Notes

Card data and images are © Riot Games. This is an unofficial personal tool, not
affiliated with or endorsed by Riot Games.
