// Import Node.js Dependencies
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

// Import Internal Dependencies
import { BenchBrowser } from "../studio/BenchBrowser.ts";
import { BenchEditors } from "../studio/BenchEditors.ts";
import {
  DEFAULT_SETTLE_MS,
  MODE_FLAG,
  STORAGE_FLAG,
  splitList
} from "../common/flags.ts";
import { STUDIO_URL } from "../studio/StudioPage.ts";

// CONSTANTS
const kCensusKey = "__pipelineCensus";
const kCompileStep = "boot:compile";

interface CensusPipeline {
  label: string;
  kind: "render" | "compute";
  async: boolean;
  t: number;
  ready: number | null;
  used: number | null;
}

interface CensusRecord {
  clicks: number[];
  frames: number[];
  modules: number[];
  pipelines: CensusPipeline[];
}

interface CensusStep {
  name: string;
  start: number;
  end: number;
}

interface DocumentCensus extends CensusRecord {
  url: string;
  steps: CensusStep[];
}

const { values: args } = parseArgs({
  options: {
    editors: {
      type: "string",
      default: "voxel-map,voxel-model,scene,model,environment"
    },
    mode: { type: "string", default: "offline" },
    cold: { type: "boolean", default: false },
    settle: { type: "string", default: String(DEFAULT_SETTLE_MS) },
    storage: { type: "string", default: "{}" },
    base: { type: "string", default: STUDIO_URL },
    out: { type: "string", default: "perf-results/pipelines.json" }
  }
});

const editors = (await BenchEditors.read()).select(splitList(args.editors));
const settleMs = Number(args.settle);
const results: Record<string, DocumentCensus[]> = {};

for (const editor of editors) {
  const bench = await BenchBrowser.launch();
  const studio = await bench.newStudioPage({
    base: args.base,
    mode: MODE_FLAG.parse(args.mode),
    storage: STORAGE_FLAG.parse(args.storage)
  });
  await studio.page.context().addInitScript(installPipelineCensus, kCensusKey);
  await studio.open();
  if (!args.cold) {
    await studio.waitUntilOpenable(editor);
    await studio.openEditor(editor);
    await studio.page.waitForTimeout(settleMs);
    await studio.reopenWithoutTabs();
  }
  await studio.waitUntilOpenable(editor);
  await studio.openEditor(editor);
  await studio.page.waitForTimeout(settleMs);

  const documents: DocumentCensus[] = [];
  for (const frame of studio.page.frames()) {
    const census = await frame.evaluate(readPipelineCensus, kCensusKey)
      .catch(() => null);
    if (census !== null) {
      documents.push({
        url: frame.url(),
        ...census
      });
    }
  }
  await bench.close();

  results[editor.name] = documents;
  report(editor.name, documents);
}

mkdirSync(path.dirname(args.out), { recursive: true });
writeFileSync(args.out, JSON.stringify(results, null, 2));
console.log(`\n${args.out}`);

function report(
  name: string,
  documents: DocumentCensus[]
): void {
  const click = documents.flatMap((document) => document.clicks).at(-1) ?? 0;
  function since(
    t: number
  ): number {
    return Math.round(t - click);
  }

  console.log(`\n${name}`);
  for (const document of documents) {
    if (document.pipelines.length === 0) {
      continue;
    }

    const compile = document.steps.find((step) => step.name.endsWith(kCompileStep));
    const cut = compile?.end ?? Infinity;
    const needed = document.pipelines.filter(
      (pipeline) => pipeline.used !== null && pipeline.used <= cut
    );
    const early = document.pipelines.filter(
      (pipeline) => pipeline.t <= cut && (pipeline.used === null || pipeline.used > cut)
    );
    const late = document.pipelines.filter((pipeline) => pipeline.t > cut);
    const modulesBefore = document.modules.filter((t) => t <= cut).length;
    const asyncCount = document.pipelines.filter((pipeline) => pipeline.async).length;
    const readyBefore = document.pipelines
      .filter((pipeline) => pipeline.t <= cut)
      .map((pipeline) => pipeline.ready ?? pipeline.t);

    console.log(`  ${new URL(document.url).pathname}`);
    console.log(
      `    ${document.pipelines.length} pipelines (${asyncCount} async), ` +
      `${document.modules.length} shader modules, ${modulesBefore} of them by the end of compile`
    );
    if (compile !== undefined) {
      console.log(
        `    compile ${since(compile.start)} → ${since(compile.end)} ms after the click, ` +
        `${document.frames.filter((t) => t <= cut).length} canvas frames by its end, ` +
        `last early pipeline ready at ${since(Math.max(...readyBefore))}`
      );
    }
    console.log(`    drawn by the end of compile: ${needed.length}  ${materials(needed)}`);
    console.log(`    created by then, not drawn: ${early.length}  ${materials(early)}`);
    console.log(`    created after: ${late.length}  ${materials(late)}`);
  }
}

function materials(
  pipelines: CensusPipeline[]
): string {
  const counts = new Map<string, number>();
  for (const pipeline of pipelines) {
    const material = pipeline.label.replace(/^renderPipeline_/, "").replace(/_\d+$/, "") ||
      `(${pipeline.kind})`;
    counts.set(material, (counts.get(material) ?? 0) + 1);
  }

  return Array.from(counts, ([key, count]) => (count > 1 ? `${key} ×${count}` : key))
    .join(", ");
}

function readPipelineCensus(
  key: string
): Omit<DocumentCensus, "url"> | null {
  const record = Reflect.get(window, key) as CensusRecord | undefined;
  if (record === undefined) {
    return null;
  }
  const { timeOrigin } = performance;

  return {
    ...record,
    steps: performance.getEntriesByType("measure").map((entry) => {
      return {
        name: entry.name,
        start: timeOrigin + entry.startTime,
        end: timeOrigin + entry.startTime + entry.duration
      };
    })
  };
}

function installPipelineCensus(
  key: string
): void {
  type Method = (this: unknown, ...params: unknown[]) => unknown;
  const scope = globalThis as unknown as Record<
    string,
    { prototype: Record<string, Method>; } | undefined
  >;
  if (scope.GPUDevice === undefined) {
    return;
  }

  const record: CensusRecord = {
    clicks: [],
    frames: [],
    modules: [],
    pipelines: []
  };
  const byPipeline = new WeakMap<object, CensusPipeline>();
  Object.defineProperty(window, key, { value: record });
  function now(): number {
    return performance.timeOrigin + performance.now();
  }

  function wrap(
    owner: string,
    method: string,
    around: (original: Method) => Method
  ): void {
    const prototype = scope[owner]?.prototype;
    const original = prototype?.[method];
    if (prototype !== undefined && typeof original === "function") {
      prototype[method] = around(original);
    }
  }

  wrap("GPUDevice", "createShaderModule", (original) => function createShaderModule(...params) {
    record.modules.push(now());

    return original.apply(this, params);
  });
  for (const [method, kind, async] of [
    ["createRenderPipeline", "render", false],
    ["createComputePipeline", "compute", false],
    ["createRenderPipelineAsync", "render", true],
    ["createComputePipelineAsync", "compute", true]
  ] as const) {
    wrap("GPUDevice", method, (original) => function createPipeline(...params) {
      const descriptor = (params[0] ?? {}) as { label?: string; };
      const pipeline: CensusPipeline = {
        label: descriptor.label ?? "",
        kind,
        async,
        t: now(),
        ready: null,
        used: null
      };
      record.pipelines.push(pipeline);
      const result = original.apply(this, params);
      if (!async) {
        pipeline.ready = pipeline.t;
        byPipeline.set(result as object, pipeline);

        return result;
      }

      return (result as Promise<object>).then((created) => {
        pipeline.ready = now();
        byPipeline.set(created, pipeline);

        return created;
      });
    });
  }
  for (const owner of ["GPURenderPassEncoder", "GPURenderBundleEncoder", "GPUComputePassEncoder"]) {
    wrap(owner, "setPipeline", (original) => function setPipeline(...params) {
      const pipeline = byPipeline.get(params[0] as object);
      if (pipeline !== undefined && pipeline.used === null) {
        pipeline.used = now();
      }

      return original.apply(this, params);
    });
  }
  wrap("GPUCanvasContext", "getCurrentTexture", (original) => function getCurrentTexture(...params) {
    record.frames.push(now());

    return original.apply(this, params);
  });

  addEventListener(
    "dblclick",
    (event) => record.clicks.push(performance.timeOrigin + event.timeStamp),
    true
  );
}
