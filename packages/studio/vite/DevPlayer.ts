// Import Node.js Dependencies
import fs from "node:fs/promises";

// Import Third-party Dependencies
import {
  build,
  type InlineConfig,
  type Logger,
  type PluginOption,
  type Rolldown
} from "vite";
import {
  PLAY_PAGE_DIR,
  PLAY_PAGE_PATH,
  type GamePlayer,
  type PlayerBundle
} from "@jolly-pixel/server";

// Import Internal Dependencies
import {
  PageInput,
  virtualPages
} from "./PageInput.ts";

// CONSTANTS
const kVirtualModule = "\0";
const kDependencyFolder = "/node_modules/";
const kQuery = "?";
const kChangedSinceBuild = "changed";
const kMissing = "missing";
const kProductionBuild = {
  mode: "production",
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

export interface DevPlayerOptions {
  /**
   * The studio root, holding `pages/play.html`.
   */
  root: string;
  /**
   * The plugins the player's imports need, such as the runtime
   * contributions.
   */
  plugins: PluginOption[];
  logger: Logger;
}

export class DevPlayer implements GamePlayer {
  #config: InlineConfig;
  #pageFile: string;
  #current: Promise<PlayerBuild> | null = null;

  constructor(
    options: DevPlayerOptions
  ) {
    const { root, plugins, logger } = options;
    const page = PageInput.shell(root, PLAY_PAGE_DIR);
    this.#pageFile = page.source;
    this.#config = {
      ...kProductionBuild,
      configFile: false,
      root,
      base: "./",
      publicDir: false,
      logLevel: "warn",
      customLogger: logger,
      plugins: [
        {
          name: "studio-player-page",
          ...virtualPages(new Map([[page.id, page]]))
        },
        ...plugins
      ],
      build: {
        write: false,
        rolldownOptions: {
          input: page.id
        }
      }
    };
  }

  async bundle(): Promise<PlayerBundle> {
    const current = this.#fresh(this.#current);
    this.#current = current;
    const { page, files } = await current;

    return {
      page,
      files: new Map(files)
    };
  }

  async #fresh(
    previous: Promise<PlayerBuild> | null
  ): Promise<PlayerBuild> {
    const built = await previous?.catch(() => null) ?? null;
    if (built !== null && await built.fresh()) {
      return built;
    }

    return PlayerBuild.run(this.#config, this.#pageFile);
  }
}

class PlayerBuild implements PlayerBundle {
  readonly page: string;
  readonly files: ReadonlyMap<string, Uint8Array>;
  #modules: ReadonlyMap<string, string>;

  static async run(
    config: InlineConfig,
    pageFile: string
  ): Promise<PlayerBuild> {
    const startedAt = Date.now();
    const result = await build(config);
    if (!("output" in result)) {
      throw new TypeError("the player build returned more than one output");
    }

    const modules = new Set([pageFile]);
    for (const file of result.output) {
      if (file.type === "chunk") {
        for (const id of file.moduleIds) {
          modules.add(id.split(kQuery)[0]);
        }
      }
    }

    const files = new Map(result.output.map(
      (file) => [file.fileName, fileBytes(file)]
    ));
    const html = files.get(PLAY_PAGE_PATH);
    if (html === undefined) {
      throw new TypeError(`the player build emitted no ${PLAY_PAGE_PATH}`);
    }
    files.delete(PLAY_PAGE_PATH);

    const fingerprints = await Promise.all(
      Array.from(modules).filter(isProjectSource).map(async(file) => [
        file,
        await fingerprint(file, startedAt)
      ] as const)
    );

    return new PlayerBuild(
      new TextDecoder().decode(html),
      files,
      new Map(fingerprints)
    );
  }

  constructor(
    page: string,
    files: ReadonlyMap<string, Uint8Array>,
    modules: ReadonlyMap<string, string>
  ) {
    this.page = page;
    this.files = files;
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

function fileBytes(
  file: Rolldown.OutputChunk | Rolldown.OutputAsset
): Uint8Array {
  const content = file.type === "chunk" ? file.code : file.source;

  return typeof content === "string" ?
    new TextEncoder().encode(content) :
    content;
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
