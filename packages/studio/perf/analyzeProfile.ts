// Import Node.js Dependencies
import path from "node:path";
import { parseArgs } from "node:util";

// Import Internal Dependencies
import { FrameLocator } from "./analysis/FrameLocator.ts";
import { ProfileTree } from "./analysis/ProfileTree.ts";
import { Tally } from "./analysis/Tally.ts";
import { BenchEditors } from "./harness/BenchEditors.ts";

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
    "Usage: analyzeProfile.ts <file.cpuprofile|file.heapprofile> " +
    "[--top n] [--from ms] [--until ms] [--stacks regex]"
  );
}

const locator = new FrameLocator(await BenchEditors.read());
const tree = ProfileTree.read(file, {
  fromMs: args.from === undefined ? undefined : Number(args.from),
  untilMs: args.until === undefined ? undefined : Number(args.until)
});
const { weights } = tree;
const measure = tree.unit === "us" ? "Self time" : "Allocated";

const byPackage = new Tally();
const byFile = new Tally();
const byFunction = new Tally();
for (const { key: id, total } of weights) {
  const location = locator.locate(tree.frame(id));
  byPackage.add(location.pkg, total);
  byFile.add(location.file, total);
  byFunction.add(location.label, total);
}

console.log(`# ${path.basename(file)}: ${format(weights.total)} sampled`);
print(`${measure} by package`, byPackage);
print(`${measure} by file`, byFile);
print(`${measure} by function`, byFunction);

if (args.stacks !== undefined) {
  const pattern = new RegExp(args.stacks);
  const stacks = new Tally();
  for (const { key: id, total } of weights) {
    if (pattern.test(locator.locate(tree.frame(id)).label)) {
      const chain = Array.from(tree.callers(id), (callFrame) => locator.locate(callFrame).label)
        .slice(0, Number(args.depth));
      stacks.add(chain.join("\n    <- "), total);
    }
  }
  print(`Stacks for /${args.stacks}/`, stacks);
}

if (args.inclusive !== undefined) {
  const pattern = new RegExp(args.inclusive);
  const inclusive = new Tally();
  for (const { key: id, total } of weights) {
    const labels = new Set(
      Array.from(tree.callers(id), (callFrame) => locator.locate(callFrame).label)
        .filter((label) => pattern.test(label))
    );
    for (const label of labels) {
      inclusive.add(label, total);
    }
  }
  print(`Inclusive ${measure.toLowerCase()} of /${args.inclusive}/`, inclusive);
}

function format(
  value: number
): string {
  return tree.unit === "us" ?
    `${(value / 1000).toFixed(1).padStart(8)} ms` :
    `${(value / 1024).toFixed(0).padStart(8)} KB`;
}

function print(
  title: string,
  tally: Tally
): void {
  console.log(`\n## ${title}`);
  for (const { key, total } of tally.top(Number(args.top))) {
    console.log(`${format(total)} ${(100 * total / weights.total).toFixed(1).padStart(5)}%  ${key}`);
  }
}
