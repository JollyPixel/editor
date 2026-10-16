// Import Node.js Dependencies
import { parseArgs } from "node:util";

// Import Internal Dependencies
import { Tally } from "./analysis/Tally.ts";
import {
  Trace,
  type GcPauses,
  type Span
} from "./analysis/Trace.ts";

// CONSTANTS
const kThreads = /CrRendererMain|CrGpuMain/;
const kGpuWork = new RegExp([
  "APICreateRenderPipeline",
  "APICreateComputePipeline",
  "CompileShaderDXC",
  "CompileShaderFXC",
  "ShaderModuleD3D12::Compile",
  "Program::MainLinkLoadEvent::wait",
  "CompileEvent::wait",
  "CommandBufferProxyImpl::WaitForGetOffset",
  "CommandBufferProxyImpl::Initialize",
  "WebGPUDecoderImpl::HandleDawnCommands"
].join("|"));
const kTaskChildren = new RegExp([
  "FunctionCall",
  "EvaluateScript",
  "v8\\.evaluateModule",
  "UpdateLayoutTree",
  "^Layout$",
  "WaitForGetOffset",
  "GLES2::GetString",
  "CommandBufferProxyImpl::Initialize",
  "RunMicrotasks",
  "FireAnimationFrame",
  "V8\\.GC"
].join("|"));
const kLongTaskUs = 15_000;

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    top: { type: "string", default: "12" },
    window: { type: "string", default: "3000" }
  }
});

const [file] = positionals;
if (file === undefined) {
  throw new Error("Usage: analyzeTrace.ts <trace.json> [--top n] [--window ms]");
}

const trace = Trace.read(file);
const { events, spans } = trace;

printThreadSelfTime();
printGpuWork();
printMainTimeline();
printGarbageCollections();

function printThreadSelfTime(): void {
  const byThread = new Map<string, Span[]>();
  for (const span of spans) {
    const key = Trace.threadKey(span);
    if (kThreads.test(trace.threadName(span))) {
      const list = byThread.get(key) ?? [];
      list.push(span);
      byThread.set(key, list);
    }
  }

  for (const [key, list] of byThread) {
    list.sort((a, b) => a.ts - b.ts || b.dur - a.dur);
    const selfTimes = new Tally();
    const stack: Span[] = [];
    let busy = 0;
    for (const span of list) {
      while (stack.length > 0 && stack.at(-1)!.ts + stack.at(-1)!.dur <= span.ts) {
        stack.pop();
      }
      const parent = stack.at(-1);
      if (parent === undefined) {
        busy += span.dur;
      }
      else {
        selfTimes.add(parent.name, -Math.min(span.dur, parent.ts + parent.dur - span.ts));
      }
      selfTimes.add(span.name, span.dur);
      stack.push(span);
    }
    console.log(`\n## ${trace.threadName(list[0])} (${key}): busy ${ms(busy)}`);
    for (const { key: name, total: us } of selfTimes.top(Number(args.top))) {
      console.log(`${ms(us).padStart(10)}  ${name}`);
    }
  }
}

function printGpuWork(): void {
  const work = new Tally();
  for (const span of spans) {
    if (kGpuWork.test(span.name)) {
      work.add(`${trace.threadName(span)} | ${span.name}`, span.dur);
    }
  }

  console.log("\n## GPU work and waits");
  for (const { key, total: us, count } of work.top(Infinity)) {
    console.log(`${ms(us).padStart(10)} ${String(count).padStart(5)}x  ${key}`);
  }
}

function printMainTimeline(): void {
  const click = events.find(
    (event) => event.name === "EventDispatch" && event.args?.data?.type === "dblclick"
  );
  if (click === undefined) {
    return;
  }
  const end = click.ts + Number(args.window) * 1000;
  const main = spans
    .filter((span) => Trace.threadKey(span) === Trace.threadKey(click) &&
      span.ts >= click.ts &&
      span.ts < end)
    .sort((a, b) => a.ts - b.ts);

  console.log("\n## Main-thread tasks after the click (> 15 ms)");
  let taskEnd = 0;
  for (const task of main) {
    if (task.name !== "ThreadControllerImpl::RunTask" || task.ts < taskEnd) {
      continue;
    }
    taskEnd = task.ts + task.dur;
    if (task.dur < kLongTaskUs) {
      continue;
    }
    const children = new Tally();
    for (const span of main) {
      const inside = span !== task && span.ts >= task.ts && span.ts + span.dur <= taskEnd;
      if (inside && kTaskChildren.test(span.name)) {
        children.add(span.name, span.dur);
      }
    }
    const summary = children.top(4)
      .map(({ key: name, total: us }) => `${name} ${ms(us)}`)
      .join(", ");
    console.log(`@${ms(task.ts - click.ts).padStart(9)} ${ms(task.dur).padStart(9)}  ${summary}`);
  }
}

function printGarbageCollections(): void {
  const { minor, major } = trace.garbageCollections();
  console.log("\n## Garbage collection on the renderer main thread");
  printPauses(minor, "minor (scavenge)");
  printPauses(major, "major (mark-compact and incremental steps)");
}

function printPauses(
  pauses: GcPauses,
  title: string
): void {
  console.log(`${ms(pauses.ms * 1000).padStart(10)} ${String(pauses.count).padStart(5)}x  ${title}`);
}

function ms(
  us: number
): string {
  return `${(us / 1000).toFixed(0)} ms`;
}
