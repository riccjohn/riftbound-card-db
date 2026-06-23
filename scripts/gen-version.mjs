#!/usr/bin/env node
// Writes public/version.js with a build version derived from git. Runs before
// `serve`/`start`. The string changes whenever HEAD moves (or the tree is
// dirty), which is what drives both the on-page version label and the service
// worker cache-bust — sw.js is registered as `sw.js?v=<version>`, so a new
// version means a new SW URL, a fresh install, and a swapped shell cache.
import { execSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

let version = "dev";
try {
  version = execSync("git describe --tags --always --dirty", { encoding: "utf8" }).trim();
} catch {
  // Not a git checkout (e.g. a release tarball) — fall back to "dev".
}

const OUT = resolve(fileURLToPath(import.meta.url), "../../public/version.js");
// Plain assignment so this works both as a <script> in the page (window) and
// via importScripts/global lookup in the service worker (self).
await writeFile(OUT, `self.APP_VERSION = ${JSON.stringify(version)};\n`);
console.log(`version.js → ${version}`);
