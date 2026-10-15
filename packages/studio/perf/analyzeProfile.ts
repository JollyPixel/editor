// Import Node.js Dependencies
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

// Import Internal Dependencies
import { editorOfUrl } from "./editors.ts";
import {
  SourceMap,
  packageOf
} from "./sourceMap.ts";

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

const profile: CpuProfile = JSON.parse(readFileSync(file, "utf8"));
const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
const parents = new Map<number, number>();
for (const node of profile.nodes) {
  for (const child of node.children ?? []) {
    parents.set(child, node.id);
  }
}
const maps = new Map<string, SourceMap | null>();
const selfTime = sampleSelfTime();
const total = [...selfTime.values()].reduce((sum, value) => sum + value, 0);

const byPackage = new Map<string, number>();
const byFile = new Map<string, number>();
const byFunction = new Map<string, number>();
for (const [id, us] of selfTime) {
  const location = locate(nodes.get(id)!.callFrame);
  add(byPackage, location.pkg, us);
  add(byFile, location.file, us);
  add(byFunction, location.label, us);
}

console.log(`# ${path.basename(file)}: ${format(total)} sampled`);
print("Self time by package", byPackage);
print("Self time by file", byFile);
print("Self time by function", byFunction);

if (args.stacks !== undefined) {
  const pattern = new RegExp(args.stacks);
  const stacks = new Map<string, number>();
  for (const [id, us] of selfTime) {
    if (!pattern.test(locate(nodes.get(id)!.callFrame).label)) {
      continue;
    }
    add(stacks, callerChain(id).join("\n    <- "), us);
  }
  print(`Stacks for /${args.stacks}/`, stacks);
}

function sampleSelfTime(): Map<number, number> {
  const from = args.from === undefined ? -Infinity : Number(args.from) * 1000;
  const until = args.until === undefined ? Infinity : Number(args.until) * 1000;
  const times = new Map<number, number>();
  let elapsed = 0;
  for (let index = 0; index < profile.samples.length; index++) {
    elapsed += profile.timeDeltas[index];
    if (elapsed < from || elapsed > until) {
      continue;
    }
    add(times, profile.samples[index], profile.timeDeltas[index + 1] ?? 0);
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

    return {
      label: name,
      file: name.startsWith("(") ? name : "(native)",
      pkg: name.startsWith("(") ? name : "(native)"
    };
  }

  const map = callFrame.lineNumber >= 0 ? sourceMapOf(callFrame.url) : null;
  const position = map?.originalPosition(callFrame.lineNumber, callFrame.columnNumber) ?? null;
  if (position === null) {
    const url = callFrame.url.replace(/^https?:\/\/[^/]+/, "");
    const pkg = editorOfUrl(callFrame.url) === null ? "(studio shell)" : "(editor, unmapped)";

    return {
      label: `${callFrame.functionName || "(anonymous)"} ${url}:${callFrame.lineNumber + 1}`,
      file: url,
      pkg
    };
  }

  const short = position.source
    .replace(/^.*node_modules\//, "")
    .replace(/^.*packages\//, "")
    .replace(/^(\.\.\/)+/, "");

  return {
    label: `${position.name ?? callFrame.functionName} ${short}:${position.line}`,
    file: short,
    pkg: packageOf(position.source)
  };
}

function sourceMapOf(
  url: string
): SourceMap | null {
  if (!maps.has(url)) {
    const editor = editorOfUrl(url);
    const asset = /\/editors\/[\w-]+\/(assets\/[^?]+)/.exec(url)?.[1];
    const map = editor === null || asset === undefined ?
      null :
      SourceMap.load(path.join(editor.dist, asset));
    maps.set(url, map);
  }

  return maps.get(url) ?? null;
}

function add<T>(
  map: Map<T, number>,
  key: T,
  value: number
): void {
  map.set(key, (map.get(key) ?? 0) + value);
}

function format(
  us: number
): string {
  return `${(us / 1000).toFixed(1).padStart(8)} ms`;
}

function print(
  title: string,
  map: Map<string, number>
): void {
  console.log(`\n## ${title}`);
  for (const [key, us] of [...map].sort((a, b) => b[1] - a[1]).slice(0, Number(args.top))) {
    console.log(`${format(us)} ${(100 * us / total).toFixed(1).padStart(5)}%  ${key}`);
  }
}
