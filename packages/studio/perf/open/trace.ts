// Import Node.js Dependencies
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

// Import Third-party Dependencies
import { TIMELINE_CATEGORIES } from "@jolly-pixel/cdp";

// Import Internal Dependencies
import { BenchBrowser } from "../studio/BenchBrowser.ts";
import { BenchEditors } from "../studio/BenchEditors.ts";
import {
  DEFAULT_SETTLE_MS,
  MODE_FLAG,
  STORAGE_FLAG
} from "../common/flags.ts";
import { STUDIO_URL } from "../studio/StudioPage.ts";

const { values: args } = parseArgs({
  options: {
    editor: { type: "string", default: "voxel-map" },
    mode: { type: "string", default: "offline" },
    warm: { type: "boolean", default: false },
    settle: { type: "string", default: String(DEFAULT_SETTLE_MS) },
    storage: { type: "string", default: "{}" },
    base: { type: "string", default: STUDIO_URL },
    out: { type: "string", default: "perf-results/traces" }
  }
});

const [editor] = (await BenchEditors.read()).select([args.editor]);
const settleMs = Number(args.settle);
const bench = await BenchBrowser.launch();
const studio = await bench.newStudioPage({
  base: args.base,
  mode: MODE_FLAG.parse(args.mode),
  storage: STORAGE_FLAG.parse(args.storage)
});
await studio.open();
if (args.warm) {
  await studio.waitUntilOpenable(editor);
  await studio.openEditor(editor);
  await studio.page.waitForTimeout(settleMs);
  await studio.reopenWithoutTabs();
}
await studio.waitUntilOpenable(editor);

await bench.browser.startTracing(undefined, { categories: TIMELINE_CATEGORIES });
await studio.openEditor(editor);
await studio.page.waitForTimeout(settleMs);
const trace = await bench.browser.stopTracing();
await bench.close();

mkdirSync(args.out, { recursive: true });
const file = path.join(args.out, `${editor.name}-${args.warm ? "warm" : "cold"}.json`);
writeFileSync(file, trace);
console.log(file);
