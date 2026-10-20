// Import Internal Dependencies
import { BenchmarkConfig } from "./config.ts";
import {
  discover,
  loadSuite
} from "./discover.ts";
import {
  BenchmarkError,
  failOnBenchmarkError
} from "./errors/index.ts";
import { Flag } from "./flags/Flag.ts";
import { FlagSet } from "./flags/FlagSet.ts";
import { hasFailure } from "./report/index.ts";
import {
  runSuites,
  type BenchmarkSuite
} from "./suite/suite.ts";

await failOnBenchmarkError(async() => {
  const env = BenchmarkConfig.fromEnvironment();
  const flags = new FlagSet({
    task: Flag.text("substring", "run only the tasks whose name contains it"),
    json: Flag.toggle("emit one JSON object per suite instead of a table"),
    time: Flag.positive(env.time, "sampling budget per task", "ms"),
    iterations: Flag.positive(env.iterations, "minimum samples per task"),
    "warmup-time": Flag.positive(
      env.warmupTime,
      "warmup budget per task",
      "ms"
    ),
    "warmup-iterations": Flag.positive(
      env.warmupIterations,
      "minimum warmup samples per task"
    ),
    batch: Flag.positive(env.batch, "calls per iteration for batched tasks"),
    allocations: Flag.toggle("add a B/op column, measured after sampling"),
    pattern: Flag.text("glob", "override the discovery glob"),
    ignore: Flag.list("substring", "skip matching files, repeatable"),
    cwd: Flag.text("dir", "directory to discover from"),
    list: Flag.toggle("print the discovered files and exit")
  });

  const parsed = flags.parse(process.argv.slice(2), {
    allowPositionals: true
  });
  if (parsed.help) {
    console.log(`Usage: jolly-bench [filter...] [options]

Discovers bench/**/*.bench.ts from the current directory and runs every
default-exported suite, in path order. A filter keeps the files whose path
contains it.

Options:
${flags.usage()}

Node flags cannot pass through this bin. Use NODE_OPTIONS, or run
node node_modules/@jolly-pixel/bench/src/cli.ts instead.`);

    return;
  }

  const { values, positionals } = parsed;
  const cwd = values.cwd ?? process.cwd();
  const files = discover({
    cwd,
    pattern: values.pattern,
    ignore: values.ignore,
    filters: positionals
  });
  if (values.list) {
    console.log(files.join("\n"));

    return;
  }
  if (files.length === 0) {
    throw new BenchmarkError(
      positionals.length === 0 ?
        "No benchmark file found" :
        `No benchmark file matched ${positionals.join(", ")}`
    );
  }

  const config = new BenchmarkConfig({
    time: values.time,
    iterations: values.iterations,
    warmupTime: values["warmup-time"],
    warmupIterations: values["warmup-iterations"],
    batch: values.batch,
    format: values.json ? "json" : env.format,
    task: values.task ?? env.task,
    allocations: values.allocations || env.allocations
  });
  const suites: BenchmarkSuite[] = [];
  for (const file of files) {
    suites.push(await loadSuite(file, cwd));
  }

  const reports = await runSuites(suites, { config });
  if (reports.some(hasFailure)) {
    process.exitCode = 1;
  }
});
