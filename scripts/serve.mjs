#!/usr/bin/env node
// Minimal static file server for the ./public app. Service workers require a
// real http origin (they don't run from file://), so use this for local viewing.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "../../public");
const PORT = process.env.PORT || 8080;
const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".json": "application/json",
  ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json",
  ".css": "text/css", ".png": "image/png",
};

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/") p = "/index.html";
    const file = join(ROOT, normalize(p));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end("Forbidden"); return; }
    const data = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(PORT, () => console.log(`Riftbound DB → http://localhost:${PORT}`));
