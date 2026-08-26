#!/usr/bin/env node
// Import Node.js Dependencies
import { parseArgs } from "node:util";

// Import Internal Dependencies
import {
  BenchmarkError,
  configure,
  discover,
  hasFailure,
  loadSuite,
  runSuites,
  type BenchmarkSuite
} from "./index.ts";
import { positiveNumber } from "./utils/parse.ts";

// CONSTANTS
const kUsage = `Usage: jolly-bench [filter...] [options]

Discovers bench/**/*.bench.ts from the current directory and runs every
default-exported suite, in path order. A filter keeps the files whose path
contains it.

Options:
  --task <substring>       run only the tasks whose name contains it
  --json                   emit one JSON object per suite instead of a table
  --time <ms>              sampling budget per task
  --iterations <n>         minimum samples per task
  --warmup-time <ms>       warmup budget per task
  --warmup-iterations <n>  minimum warmup samples per task
  --batch <n>              calls per iteration for batched tasks
  --pattern <glob>         override the discovery glob
  --ignore <substring>     skip matching files, repeatable
  --cwd <dir>              directory to discover from
  --list                   print the discovered files and exit
  --help                   print this message

Node flags cannot pass through this bin. Use NODE_OPTIONS, or run
node node_modules/@jolly-pixel/bench/src/cli.ts instead.`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    task: { type: "string" },
    json: { type: "boolean", default: false },
    time: { type: "string" },
    iterations: { type: "string" },
    "warmup-time": { type: "string" },
    "warmup-iterations": { type: "string" },
    batch: { type: "string" },
    pattern: { type: "string" },
    ignore: { type: "string", multiple: true, default: [] },
    cwd: { type: "string" },
    list: { type: "boolean", default: false },
    help: { type: "boolean", default: false }
  }
});

if (values.help) {
  console.log(kUsage);
  process.exit(0);
}

const cwd = values.cwd ?? process.cwd();
const files = discover({
  cwd,
  pattern: values.pattern,
  ignore: values.ignore,
  filters: positionals
});

if (values.list) {
  console.log(files.join("\n"));
  process.exit(0);
}

try {
  configure({
    task: values.task,
    format: values.json ? "json" : undefined,
    time: optionalNumber("time", values.time),
    iterations: optionalNumber("iterations", values.iterations),
    warmupTime: optionalNumber("warmup-time", values["warmup-time"]),
    warmupIterations: optionalNumber(
      "warmup-iterations",
      values["warmup-iterations"]
    ),
    batch: optionalNumber("batch", values.batch)
  });

  if (files.length === 0) {
    throw new BenchmarkError(
      positionals.length === 0 ?
        "No benchmark file found" :
        `No benchmark file matched ${positionals.join(", ")}`
    );
  }

  const suites: BenchmarkSuite[] = [];
  for (const file of files) {
    suites.push(await loadSuite(file, cwd));
  }

  const reports = await runSuites(suites);
  if (reports.some(hasFailure)) {
    process.exitCode = 1;
  }
}
catch (error) {
  if (error instanceof BenchmarkError) {
    console.error(error.message);
    process.exitCode = 1;
  }
  else {
    throw error;
  }
}

function optionalNumber(
  name: string,
  raw: string | undefined
): number | undefined {
  if (raw === undefined) {
    return undefined;
  }

  const value = positiveNumber(raw);
  if (value === null) {
    throw new BenchmarkError(
      `--${name} expects a positive number, got "${raw}"`
    );
  }

  return value;
}
