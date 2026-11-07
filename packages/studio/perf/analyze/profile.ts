// Import Node.js Dependencies
import path from "node:path";
import { parseArgs } from "node:util";

// Import Third-party Dependencies
import {
  ProfileTree,
  Tally,
  TimeWindow
} from "@jolly-pixel/cdp";

// Import Internal Dependencies
import { FrameLocator } from "./FrameLocator.ts";
import { BenchEditors } from "../studio/BenchEditors.ts";

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    top: { type: "string", default: "25" },
    from: { type: "string" },
    until: { type: "string" },
    stacks: { type: "string" },
    inclusive: { type: "string" },
    depth: { type: "string", default: "10" }
  }
});

const [file] = positionals;
if (file === undefined) {
  throw new Error(
    "Usage: analyze/profile.ts <file.cpuprofile|file.heapprofile> " +
    "[--top n] [--from ms] [--until ms] [--stacks regex]"
  );
}

const locator = new FrameLocator(await BenchEditors.read());
const tree = ProfileTree.read(file, TimeWindow.between(
  args.from === undefined ? undefined : Number(args.from),
  args.until === undefined ? undefined : Number(args.until)
));
const { measure } = tree;

const byPackage = new Tally();
const byFile = new Tally();
const byFunction = new Tally();
for (const node of tree.nodes()) {
  const location = locator.locate(node.frame);
  byPackage.add(location.pkg, node.weight);
  byFile.add(location.file, node.weight);
  byFunction.add(location.label, node.weight);
}

console.log(`# ${path.basename(file)}: ${format(tree.total)} sampled`);
print(`${measure.title} by package`, byPackage);
print(`${measure.title} by file`, byFile);
print(`${measure.title} by function`, byFunction);

if (args.stacks !== undefined) {
  const pattern = new RegExp(args.stacks);
  const stacks = new Tally();
  for (const node of tree.nodes()) {
    if (pattern.test(locator.locate(node.frame).label)) {
      const chain = Array.from(node.stack(), (callFrame) => locator.locate(callFrame).label)
        .slice(0, Number(args.depth));
      stacks.add(chain.join("\n    <- "), node.weight);
    }
  }
  print(`Stacks for /${args.stacks}/`, stacks);
}

if (args.inclusive !== undefined) {
  const pattern = new RegExp(args.inclusive);
  const inclusive = new Tally();
  for (const node of tree.nodes()) {
    const labels = new Set(
      Array.from(node.stack(), (callFrame) => locator.locate(callFrame).label)
        .filter((label) => pattern.test(label))
    );
    for (const label of labels) {
      inclusive.add(label, node.weight);
    }
  }
  print(`Inclusive ${measure.title.toLowerCase()} of /${args.inclusive}/`, inclusive);
}

function format(
  value: number
): string {
  return measure.format(value).padStart(11);
}

function print(
  title: string,
  tally: Tally
): void {
  console.log(`\n## ${title}`);
  for (const { key, total } of tally.top(Number(args.top))) {
    console.log(`${format(total)} ${(100 * total / tree.total).toFixed(1).padStart(5)}%  ${key}`);
  }
}
