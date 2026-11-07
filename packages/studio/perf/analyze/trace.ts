// Import Node.js Dependencies
import { parseArgs } from "node:util";

// Import Third-party Dependencies
import {
  Tally,
  TimeWindow,
  Trace,
  type GcPauses
} from "@jolly-pixel/cdp";

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
  throw new Error("Usage: analyze/trace.ts <trace.json> [--top n] [--window ms]");
}

const trace = Trace.read(file);

printThreadSelfTime();
printGpuWork();
printMainTimeline();
printGarbageCollections();

function printThreadSelfTime(): void {
  for (const thread of trace.threads()) {
    if (!kThreads.test(thread.name)) {
      continue;
    }
    console.log(`\n## ${thread.name} (${thread.id}): busy ${ms(thread.busy())}`);
    for (const { key: name, total: us } of thread.selfTimes().top(Number(args.top))) {
      console.log(`${ms(us).padStart(10)}  ${name}`);
    }
  }
}

function printGpuWork(): void {
  const work = new Tally();
  for (const thread of trace.threads()) {
    for (const span of thread.spans) {
      if (kGpuWork.test(span.name)) {
        work.add(`${thread.name} | ${span.name}`, span.duration);
      }
    }
  }

  console.log("\n## GPU work and waits");
  for (const { key, total: us, count } of work.top(Infinity)) {
    console.log(`${ms(us).padStart(10)} ${String(count).padStart(5)}x  ${key}`);
  }
}

function printMainTimeline(): void {
  const click = trace.events.find(
    (event) => event.name === "EventDispatch" && event.args?.data?.type === "dblclick"
  );
  if (click === undefined) {
    return;
  }
  const main = trace.threadRunning(click)
    .spansStartingWithin(TimeWindow.following(click.ts, Number(args.window)));

  console.log("\n## Main-thread tasks after the click (> 15 ms)");
  let taskEnd = 0;
  for (const task of main) {
    if (task.name !== "ThreadControllerImpl::RunTask" || task.start < taskEnd) {
      continue;
    }
    taskEnd = task.end;
    if (task.duration < kLongTaskUs) {
      continue;
    }
    const children = new Tally();
    for (const span of main) {
      if (span !== task && task.contains(span) && kTaskChildren.test(span.name)) {
        children.add(span.name, span.duration);
      }
    }
    const summary = children.top(4)
      .map(({ key: name, total: us }) => `${name} ${ms(us)}`)
      .join(", ");
    console.log(`@${ms(task.start - click.ts).padStart(9)} ${ms(task.duration).padStart(9)}  ${summary}`);
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
