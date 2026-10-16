// Import Node.js Dependencies
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

// Import Third-party Dependencies
import {
  chromium,
  type Page
} from "@playwright/test";

// Import Internal Dependencies
import {
  EXPANDED_STORAGE_KEY,
  SEED_FOLDERS,
  STUDIO_URL,
  editorFrameSelector,
  parseEditors,
  type BenchEditor
} from "./editors.ts";

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
const kSeedRowIndex = 5;
const kReadyTimeoutMs = 60_000;

const { values: args } = parseArgs({
  options: {
    editor: { type: "string", default: "voxel-map" },
    warm: { type: "boolean", default: false },
    settle: { type: "string", default: "4000" },
    storage: { type: "string", default: "{}" },
    out: { type: "string", default: "perf-results/traces" }
  }
});

const [editor] = parseEditors(args.editor);
const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({
  viewport: {
    width: 1600,
    height: 900
  }
});
await context.addInitScript((storage: Record<string, string>) => {
  for (const [key, value] of Object.entries(storage)) {
    localStorage.setItem(key, value);
  }
}, {
  [EXPANDED_STORAGE_KEY]: JSON.stringify(SEED_FOLDERS),
  ...JSON.parse(args.storage)
});
const page = await context.newPage();
await openShell(page);
if (args.warm) {
  await openEditor(page, editor);
  await page.waitForTimeout(Number(args.settle));
  await page.evaluate(() => localStorage.removeItem("studio:tabs"));
  await openShell(page);
}

await browser.startTracing(undefined, { categories: kCategories });
await openEditor(page, editor);
await page.waitForTimeout(Number(args.settle));
const trace = await browser.stopTracing();
await browser.close();

mkdirSync(args.out, { recursive: true });
const file = path.join(args.out, `${editor.name}-${args.warm ? "warm" : "cold"}.json`);
writeFileSync(file, trace);
console.log(file);

async function openShell(
  target: Page
): Promise<void> {
  await target.goto(`${STUDIO_URL}?offline`);
  await target.getByRole("treeitem").nth(kSeedRowIndex).waitFor();
  await target.waitForTimeout(800);
}

async function openEditor(
  target: Page,
  bench: BenchEditor
): Promise<void> {
  await target.getByRole("treeitem").filter({
    has: target.getByText(bench.row, { exact: true })
  }).dblclick();
  await target.locator(editorFrameSelector(bench)).contentFrame()
    .locator("html[data-editor-state=ready]")
    .waitFor({
      state: "attached",
      timeout: kReadyTimeoutMs
    });
}
