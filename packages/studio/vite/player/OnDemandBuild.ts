// Import Node.js Dependencies
import fs from "node:fs/promises";

// Import Third-party Dependencies
import {
  build,
  type InlineConfig,
  type Rolldown
} from "vite";

// CONSTANTS
const kVirtualModule = "\0";
const kDependencyFolder = "/node_modules/";
const kQuery = "?";
const kChangedSinceBuild = "changed";
const kMissing = "missing";

export const PRODUCTION_BUILD = {
  configFile: false,
  mode: "production",
  logLevel: "warn",
  publicDir: false,
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    "import.meta.env.DEV": "false",
    "import.meta.env.PROD": "true"
  },
  resolve: {
    conditions: [
      "module",
      "browser",
      "production"
    ]
  }
} satisfies InlineConfig;

export type BuildOutput = Rolldown.RolldownOutput["output"];

export interface OnDemandBuildOptions<TResult> {
  /**
   * Built with `write: false`.
   */
  config: InlineConfig;
  read: (output: BuildOutput) => TResult;
  /**
   * Files the build reads that are not modules, such as its HTML entry.
   * @default []
   */
  sources?: Iterable<string>;
}

export class OnDemandBuild<TResult> {
  #options: OnDemandBuildOptions<TResult>;
  #current: Promise<FingerprintedBuild<TResult>> | null = null;

  constructor(
    options: OnDemandBuildOptions<TResult>
  ) {
    this.#options = options;
  }

  async result(): Promise<TResult> {
    const current = this.#fresh(this.#current);
    this.#current = current;

    return (await current).result;
  }

  async #fresh(
    previous: Promise<FingerprintedBuild<TResult>> | null
  ): Promise<FingerprintedBuild<TResult>> {
    const built = await previous?.catch(() => null) ?? null;
    if (built !== null && await built.fresh()) {
      return built;
    }

    return FingerprintedBuild.run(this.#options);
  }
}

class FingerprintedBuild<TResult> {
  readonly result: TResult;
  #modules: ReadonlyMap<string, string>;

  static async run<TResult>(
    options: OnDemandBuildOptions<TResult>
  ): Promise<FingerprintedBuild<TResult>> {
    const startedAt = Date.now();
    const { output } = singleOutput(await build({
      ...options.config,
      build: {
        ...options.config.build,
        write: false
      }
    }));

    const modules = new Set(options.sources);
    for (const file of output) {
      if (file.type === "chunk") {
        for (const id of file.moduleIds) {
          modules.add(id.split(kQuery)[0]);
        }
      }
    }
    const result = options.read(output);
    const fingerprints = await Promise.all(
      Array.from(modules).filter(isProjectSource).map(async(file) => [
        file,
        await fingerprint(file, startedAt)
      ] as const)
    );

    return new FingerprintedBuild(result, new Map(fingerprints));
  }

  constructor(
    result: TResult,
    modules: ReadonlyMap<string, string>
  ) {
    this.result = result;
    this.#modules = modules;
  }

  async fresh(): Promise<boolean> {
    const checks = Array.from(
      this.#modules,
      async([file, built]) => await fingerprint(file) === built
    );

    return (await Promise.all(checks)).every(Boolean);
  }
}

function singleOutput(
  result: Awaited<ReturnType<typeof build>>
): Rolldown.RolldownOutput {
  const outputs = Array.isArray(result) ? result : [result];
  const [first] = outputs;
  if (outputs.length !== 1 || first === undefined || !("output" in first)) {
    throw new TypeError("the build returned more than one output");
  }

  return first;
}

function isProjectSource(
  file: string
): boolean {
  return !file.startsWith(kVirtualModule) &&
    !file.includes(kDependencyFolder);
}

async function fingerprint(
  file: string,
  builtSince = Number.POSITIVE_INFINITY
): Promise<string> {
  const stats = await fs.stat(file).catch(() => null);
  if (stats === null) {
    return kMissing;
  }

  return stats.mtimeMs >= builtSince ?
    kChangedSinceBuild :
    `${stats.mtimeMs}:${stats.size}`;
}
