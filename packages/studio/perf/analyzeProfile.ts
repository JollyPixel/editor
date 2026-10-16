// Import Node.js Dependencies
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

// Import Internal Dependencies
import { SourceMapFile } from "./analysis/SourceMapFile.ts";
import { Tally } from "./analysis/Tally.ts";
import { BenchEditors } from "./harness/BenchEditors.ts";

interface CallFrame {
  functionName: string;
  url: string;
  lineNumber: number;
  columnNumber: number;
}

interface ProfileNode {
  id: number;
  callFrame: CallFrame;
  children?: number[];
}

interface CpuProfile {
  nodes: ProfileNode[];
  samples: number[];
  timeDeltas: number[];
}

interface Location {
  label: string;
  file: string;
  pkg: string;
}

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    top: { type: "string", default: "25" },
    from: { type: "string" },
    until: { type: "string" },
    stacks: { type: "string" },
    depth: { type: "string", default: "10" }
  }
});

const [file] = positionals;
if (file === undefined) {
  throw new Error(
    "Usage: analyzeProfile.ts <file.cpuprofile> [--top n] [--from ms] [--until ms] [--stacks regex]"
  );
}

const editors = await BenchEditors.read();
const profile: CpuProfile = JSON.parse(readFileSync(file, "utf8"));
const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
const parents = new Map<number, number>();
for (const node of profile.nodes) {
  for (const child of node.children ?? []) {
    parents.set(child, node.id);
  }
}
const maps = new Map<string, SourceMapFile | null>();
const selfTime = sampleSelfTime();

const byPackage = new Tally();
const byFile = new Tally();
const byFunction = new Tally();
for (const { key: id, total: us } of selfTime) {
  const location = locate(nodes.get(id)!.callFrame);
  byPackage.add(location.pkg, us);
  byFile.add(location.file, us);
  byFunction.add(location.label, us);
}

console.log(`# ${path.basename(file)}: ${format(selfTime.total)} sampled`);
print("Self time by package", byPackage);
print("Self time by file", byFile);
print("Self time by function", byFunction);

if (args.stacks !== undefined) {
  const pattern = new RegExp(args.stacks);
  const stacks = new Tally();
  for (const { key: id, total: us } of selfTime) {
    if (pattern.test(locate(nodes.get(id)!.callFrame).label)) {
      stacks.add(callerChain(id).join("\n    <- "), us);
    }
  }
  print(`Stacks for /${args.stacks}/`, stacks);
}

function sampleSelfTime(): Tally<number> {
  const from = args.from === undefined ? -Infinity : Number(args.from) * 1000;
  const until = args.until === undefined ? Infinity : Number(args.until) * 1000;
  const times = new Tally<number>();
  let elapsed = 0;
  for (let index = 0; index < profile.samples.length; index++) {
    elapsed += profile.timeDeltas[index];
    if (elapsed >= from && elapsed <= until) {
      times.add(profile.samples[index], profile.timeDeltas[index + 1] ?? 0);
    }
  }

  return times;
}

function callerChain(
  id: number
): string[] {
  const chain: string[] = [];
  let cursor: number | undefined = id;
  while (cursor !== undefined && chain.length < Number(args.depth)) {
    const { callFrame } = nodes.get(cursor)!;
    if (callFrame.functionName !== "(root)") {
      chain.push(locate(callFrame).label);
    }
    cursor = parents.get(cursor);
  }

  return chain;
}

function locate(
  callFrame: CallFrame
): Location {
  if (callFrame.url === "") {
    const name = callFrame.functionName || "(native)";
    const group = name.startsWith("(") ? name : "(native)";

    return {
      label: name,
      file: group,
      pkg: group
    };
  }

  const map = callFrame.lineNumber >= 0 ? sourceMapOf(callFrame.url) : null;
  const position = map?.originalPosition(callFrame.lineNumber, callFrame.columnNumber) ?? null;
  if (position === null) {
    const url = callFrame.url.replace(/^https?:\/\/[^/]+/, "");

    return {
      label: `${callFrame.functionName || "(anonymous)"} ${url}:${callFrame.lineNumber + 1}`,
      file: url,
      pkg: editors.servingUrl(callFrame.url) === null ? "(studio shell)" : "(editor, unmapped)"
    };
  }

  const short = position.source
    .replace(/^.*node_modules\//, "")
    .replace(/^.*packages\//, "");

  return {
    label: `${position.name ?? callFrame.functionName} ${short}:${position.line}`,
    file: short,
    pkg: position.package
  };
}

function sourceMapOf(
  url: string
): SourceMapFile | null {
  if (!maps.has(url)) {
    const editor = editors.servingUrl(url);
    const asset = /\/editors\/[\w-]+\/(assets\/[^?]+)/.exec(url)?.[1];
    maps.set(
      url,
      editor === null || asset === undefined ?
        null :
        SourceMapFile.load(path.join(editor.dist, asset))
    );
  }

  return maps.get(url) ?? null;
}

function format(
  us: number
): string {
  return `${(us / 1000).toFixed(1).padStart(8)} ms`;
}

function print(
  title: string,
  tally: Tally
): void {
  console.log(`\n## ${title}`);
  for (const { key, total: us } of tally.top(Number(args.top))) {
    console.log(`${format(us)} ${(100 * us / selfTime.total).toFixed(1).padStart(5)}%  ${key}`);
  }
}
