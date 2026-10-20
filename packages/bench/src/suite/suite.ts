// Import Third-party Dependencies
import type { Bench } from "tinybench";

// Import Internal Dependencies
import { BenchmarkConfig } from "../config.ts";
import { BenchmarkError } from "../errors/index.ts";
import {
  createReport,
  createReporter,
  type BenchmarkReport,
  type Reporter
} from "../report/index.ts";
import { SuiteBench } from "./SuiteBench.ts";

export interface SuiteOptions {
  /**
   * Operations per call of a task; `batched()` tasks multiply it by the
   * batch size.
   *
   * @default 1
   */
  opsPerIteration?: number;
}

export interface BenchmarkSuite {
  name: string;
  /**
   * Returns `null` when the task filter matches nothing.
   */
  run: (config: BenchmarkConfig) => Promise<BenchmarkReport | null>;
}

export interface RunSuitesOptions {
  /**
   * @default BenchmarkConfig.fromEnvironment()
   */
  config?: BenchmarkConfig;
  /**
   * @default the reporter for `config.format`
   */
  reporter?: Reporter;
}

export type SuiteTeardown = () => void | Promise<void>;

export type SuiteSetup = (bench: Bench) =>
  SuiteTeardown | void | Promise<SuiteTeardown | void>;

export function defineSuite(
  name: string,
  setup: SuiteSetup,
  options: SuiteOptions = {}
): BenchmarkSuite {
  const { opsPerIteration = 1 } = options;

  return {
    name,
    async run(config) {
      const bench = new SuiteBench(name, config, opsPerIteration);
      const teardown = await setup(bench);

      try {
        const results = await bench.measure();

        return results === null ? null : createReport({
          suite: name,
          runtime: {
            timeMs: config.time,
            iterations: config.iterations,
            warmupTimeMs: config.warmupTime,
            warmupIterations: config.warmupIterations
          },
          results
        });
      }
      finally {
        await teardown?.();
      }
    }
  };
}

export async function runSuites(
  suites: Iterable<BenchmarkSuite>,
  options: RunSuitesOptions = {}
): Promise<BenchmarkReport[]> {
  const {
    config = BenchmarkConfig.fromEnvironment(),
    reporter = createReporter(config.format)
  } = options;
  const reports: BenchmarkReport[] = [];

  for (const suite of suites) {
    const value = await suite.run(config);
    if (value !== null) {
      reporter.print(value);
      reports.push(value);
    }
  }

  if (reports.length === 0) {
    throw new BenchmarkError(
      config.task === null ?
        "No benchmark suite to run" :
        `No benchmark task matched "${config.task}"`
    );
  }

  return reports;
}
