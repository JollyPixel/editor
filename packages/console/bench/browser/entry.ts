// Import Third-party Dependencies
import "@jolly-pixel/ui";

// Import Internal Dependencies
import "../../src/element/index.ts";
import type { ConsoleElement } from "../../src/element/Console.ts";
import {
  populate,
  sentence
} from "../fixtures.ts";

// CONSTANTS
const kSamples = 200;
const kWarmup = 30;
const kLogLines = 250;
const kAllocationSamples = 40;
const kSettleHops = 3;

export interface BrowserBenchmarkResult {
  task: string;
  "p50 (ms)": number;
  "p99 (ms)": number;
  "KB/op": number;
  samples: number;
}

export interface BrowserBenchmarkReport {
  runtime: {
    userAgent: string;
  };
  results: BrowserBenchmarkResult[];
}

interface MemoryPerformance {
  memory?: {
    usedJSHeapSize: number;
  };
}

async function runConsoleBenchmarks(): Promise<BrowserBenchmarkReport> {
  const rng = lehmer(48271);
  const commands = populate(rng, {
    namespaces: 25,
    entriesPerNamespace: 20
  });
  const output = Array.from(
    { length: kLogLines },
    (_, index) => (index % 10 === 0 ?
      Array.from({ length: 12 }, () => sentence(rng)).join("\n") :
      sentence(rng, 8))
  );
  let printed = 0;
  commands.registerCommand("log", {
    description: "Print one line",
    args: [],
    execute: (_, ctx) => ctx.print(output[printed++ % output.length])
  });

  const element = document.createElement("jolly-console");
  element.console = commands;
  document.body.append(element);
  await element.show();
  const input = element.shadowRoot!.querySelector("input")!;

  async function type(
    text: string
  ): Promise<void> {
    input.value = text;
    input.setSelectionRange(text.length, text.length);
    input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    await settle(element);
  }

  async function press(
    key: string
  ): Promise<void> {
    input.dispatchEvent(new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      composed: true,
      cancelable: true
    }));
    await settle(element);
  }

  async function fillLog(): Promise<void> {
    for (let index = 0; index < kLogLines; index++) {
      await commands.submit("/log");
    }
    await settle(element);
  }

  const results: BrowserBenchmarkResult[] = [];
  let flip = false;

  commands.clearScrollback();
  await settle(element);
  results.push(await measure("type / search, empty log", () => {
    flip = !flip;

    return type(flip ? "rot" : "rota");
  }));

  await fillLog();
  results.push(await measure("type / search, 500-entry log", () => {
    flip = !flip;

    return type(flip ? "rot" : "rota");
  }));
  results.push(await measure("type / 1 char search, 500-entry log", () => {
    flip = !flip;

    return type(flip ? "b" : "s");
  }));
  results.push(await measure("type / empty prompt browse", () => {
    flip = !flip;

    return type(flip ? "" : "z");
  }));
  results.push(await measure("type / command completion", () => {
    flip = !flip;

    return type(flip ? "/ns1" : "/ns12");
  }));

  await type("b");
  results.push(await measure("key / move highlight", () => press("ArrowDown")));

  await type("");
  results.push(await measure("log / append at capacity", async() => {
    await commands.submit("/log");
    await settle(element);
  }));

  return {
    runtime: {
      userAgent: navigator.userAgent
    },
    results
  };
}

async function measure(
  task: string,
  fn: () => Promise<void>
): Promise<BrowserBenchmarkResult> {
  for (let index = 0; index < kWarmup; index++) {
    await fn();
  }

  const timings: number[] = [];
  for (let index = 0; index < kSamples; index++) {
    const start = performance.now();
    await fn();
    timings.push(performance.now() - start);
  }
  timings.sort((left, right) => left - right);

  globalThis.gc?.();
  const before = usedHeap();
  for (let index = 0; index < kAllocationSamples; index++) {
    await fn();
  }
  const allocated = usedHeap() - before;

  return {
    task,
    "p50 (ms)": round(percentile(timings, 0.5)),
    "p99 (ms)": round(percentile(timings, 0.99)),
    "KB/op": round(allocated / kAllocationSamples / 1024),
    samples: kSamples
  };
}

async function settle(
  element: ConsoleElement
): Promise<void> {
  const log = element.shadowRoot?.querySelector("jolly-console-log");
  for (let hop = 0; hop < kSettleHops; hop++) {
    await element.updateComplete;
    await log?.updateComplete;
  }
  void element.offsetHeight;
}

function lehmer(
  seed: number
): () => number {
  let state = seed;

  return () => {
    state = (state * 48271) % 2147483647;

    return state / 2147483647;
  };
}

function usedHeap(): number {
  return (performance as MemoryPerformance).memory?.usedJSHeapSize ?? 0;
}

function percentile(
  sorted: number[],
  fraction: number
): number {
  return sorted[Math.floor((sorted.length - 1) * fraction)];
}

function round(
  value: number
): number {
  return Number(value.toFixed(3));
}

declare global {
  interface Window {
    runConsoleBenchmarks: typeof runConsoleBenchmarks;
  }
}

window.runConsoleBenchmarks = runConsoleBenchmarks;
