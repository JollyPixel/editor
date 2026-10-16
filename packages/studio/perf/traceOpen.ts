// Import Node.js Dependencies
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

// Import Internal Dependencies
import { BenchBrowser } from "./harness/BenchBrowser.ts";
import { BenchEditors } from "./harness/BenchEditors.ts";
import {
  DEFAULT_SETTLE_MS,
  MODE_FLAG,
  STORAGE_FLAG
} from "./harness/flags.ts";
import { STUDIO_URL } from "./harness/StudioPage.ts";

// CONSTANTS
const kCategories = [
  "devtools.timeline",
  "disabled-by-default-devtools.timeline",
  "toplevel",
  "blink",
  "loading",
  "v8",
  "v8.execute",
  "disabled-by-default-v8.compile",
  "gpu",
  "gpu.angle",
  "gpu.dawn",
  "disabled-by-default-gpu.dawn",
  "disabled-by-default-gpu.service",
  "disabled-by-default-gpu.decoder",
  "webgpu",
  "disabled-by-default-webgpu"
];

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
  await studio.openEditor(editor);
  await studio.page.waitForTimeout(settleMs);
  await studio.reopenWithoutTabs();
}
await studio.waitUntilOpenable(editor);

await bench.browser.startTracing(undefined, { categories: kCategories });
await studio.openEditor(editor);
await studio.page.waitForTimeout(settleMs);
const trace = await bench.browser.stopTracing();
await bench.close();

mkdirSync(args.out, { recursive: true });
const file = path.join(args.out, `${editor.name}-${args.warm ? "warm" : "cold"}.json`);
writeFileSync(file, trace);
console.log(file);
