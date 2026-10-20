// Import Node.js Dependencies
import { availableParallelism } from "node:os";

// Import Internal Dependencies
import { failOnBenchmarkError } from "../errors/index.ts";
import {
  Flag,
  type FlagDefinitions
} from "../flags/Flag.ts";
import { FlagSet } from "../flags/FlagSet.ts";
import {
  createReport,
  createReporter,
  type BenchmarkReport
} from "../report/index.ts";
import {
  measuredColumns,
  type LoadColumns
} from "./loadReport.ts";
import { runLoad } from "./runLoad.ts";

// CONSTANTS
const kDefaultWorkers = Math.max(1, Math.min(4, availableParallelism() - 2));
const kSaturatedElu = 0.8;

export interface SharedLoadValues {
  clients: number;
  /**
   * Actions per client per second.
   */
  rate: number;
  /**
   * Measured seconds.
   */
  duration: number;
  /**
   * Unmeasured seconds before the measured ones.
   */
  warmup: number;
  workers: number;
  compression: boolean;
  /**
   * Directory receiving a server `--cpu-prof`.
   */
  profile: string | undefined;
  json: boolean;
}

const kSharedFlags: FlagDefinitions<SharedLoadValues> = {
  clients: Flag.positive(50, "connected clients"),
  rate: Flag.positive(30, "actions per client per second", "hz"),
  duration: Flag.positive(10, "measured seconds", "s"),
  warmup: Flag.positive(2, "unmeasured seconds before it", "s"),
  workers: Flag.positive(kDefaultWorkers, "driver worker threads"),
  compression: Flag.toggle("negotiate permessage-deflate"),
  profile: Flag.text("dir", "write a server --cpu-prof into this directory"),
  json: Flag.toggle("print one JSON object instead of a table")
};

export interface LoadPlan<TServerConfig, TWorkload> {
  serverConfig: TServerConfig;
  workload: TWorkload;
  /**
   * Parameter columns printed before the measured ones.
   */
  columns: LoadColumns;
}

export interface LoadHarnessOptions<
  TValues extends object,
  TServerConfig,
  TWorkload
> {
  /**
   * Report title, such as `network / load`.
   */
  name: string;
  summary: string;
  /**
   * Harness flags, listed before the shared ones in the usage.
   */
  flags: FlagDefinitions<TValues>;
  server: URL;
  driver: URL;
  /**
   * Throw a `BenchmarkError` to reject a flag combination.
   */
  plan: (
    values: SharedLoadValues & TValues
  ) => LoadPlan<TServerConfig, TWorkload>;
}

export class LoadHarness<
  TValues extends object,
  TServerConfig,
  TWorkload
> {
  #options: LoadHarnessOptions<TValues, TServerConfig, TWorkload>;
  #flags: FlagSet<TValues & SharedLoadValues>;

  constructor(
    options: LoadHarnessOptions<TValues, TServerConfig, TWorkload>
  ) {
    this.#options = options;
    this.#flags = new FlagSet(options.flags).extend(kSharedFlags);
  }

  usage(): string {
    return `Usage: pnpm bench:load [options]

${this.#options.summary}

Options:
${this.#flags.usage()}`;
  }

  run(
    argv: string[] = process.argv.slice(2)
  ): Promise<BenchmarkReport<LoadColumns> | null> {
    return failOnBenchmarkError(() => this.#run(argv));
  }

  async #run(
    argv: string[]
  ): Promise<BenchmarkReport<LoadColumns> | null> {
    const parsed = this.#flags.parse(argv);
    if (parsed.help) {
      console.log(this.usage());

      return null;
    }

    const { values } = parsed;
    const { name, server, driver, plan } = this.#options;
    const { serverConfig, workload, columns } = plan(values);
    const workers = Math.min(values.clients, values.workers);
    const durationMs = values.duration * 1_000;
    const warmupMs = values.warmup * 1_000;
    const run = await runLoad({
      server,
      serverConfig,
      driver,
      workload,
      clients: values.clients,
      rate: values.rate,
      workers,
      durationMs,
      warmupMs,
      profile: values.profile
    });
    const value = createReport({
      suite: name,
      runtime: {
        durationMs,
        warmupMs,
        workers
      },
      results: [
        {
          ...columns,
          ...measuredColumns(run)
        }
      ]
    });
    createReporter(values.json ? "json" : "table").print(value);
    if (run.driverElu > kSaturatedElu) {
      console.warn(
        "A driver worker is saturated: latencies include its own queueing."
      );
    }

    return value;
  }
}
