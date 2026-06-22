#!/usr/bin/env node
// Minimal static file server for the ./public app. Service workers require a
// real http origin (they don't run from file://), so use this for local viewing.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { watch } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "../../public");
const PORT = process.env.PORT || 8080;
const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
  ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json",
  ".css": "text/css", ".png": "image/png",
};

// --- Live reload (dev only) ---
// SSE keeps a connection open per tab; when any file under public/ changes we
// nudge every tab to reload. A small client script is injected into HTML.
const clients = new Set();
let debounce;
watch(ROOT, { recursive: true }, () => {
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    for (const res of clients) res.write("data: reload\n\n");
  }, 80);
});

const RELOAD_SNIPPET = `<script>
  new EventSource("/__livereload").onmessage = () => location.reload();
</script>`;

createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);

  if (p === "/__livereload") {
    res.writeHead(200, {
      "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive",
    });
    res.write("retry: 1000\n\n");
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }

  try {
    if (p === "/") p = "/index.html";
    const file = join(ROOT, normalize(p));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end("Forbidden"); return; }
    const data = await readFile(file);
    const type = TYPES[extname(file)] || "application/octet-stream";
    if (type === "text/html") {
      const html = data.toString().replace("</body>", `${RELOAD_SNIPPET}</body>`);
      res.writeHead(200, { "content-type": type }).end(html);
    } else {
      res.writeHead(200, { "content-type": type }).end(data);
    }
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(PORT, () => console.log(`Riftbound DB → http://localhost:${PORT}`));
