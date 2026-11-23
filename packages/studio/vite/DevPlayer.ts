// Import Third-party Dependencies
import type {
  Logger,
  PluginOption,
  Rolldown
} from "vite";
import {
  PLAY_PAGE_DIR,
  PLAY_PAGE_PATH,
  type GamePlayer,
  type PlayerBundle
} from "@jolly-pixel/server";

// Import Internal Dependencies
import {
  OnDemandBuild,
  PRODUCTION_BUILD,
  type BuildOutput
} from "./OnDemandBuild.ts";
import {
  PageInput,
  virtualPages
} from "./PageInput.ts";

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
  #build: OnDemandBuild<PlayerBundle>;

  constructor(
    options: DevPlayerOptions
  ) {
    const { root, plugins, logger } = options;
    const page = PageInput.shell(root, PLAY_PAGE_DIR);
    this.#build = new OnDemandBuild({
      config: {
        ...PRODUCTION_BUILD,
        root,
        base: "./",
        customLogger: logger,
        plugins: [
          {
            name: "studio-player-page",
            ...virtualPages(new Map([[page.id, page]]))
          },
          ...plugins
        ],
        build: {
          rolldownOptions: {
            input: page.id
          }
        }
      },
      read: playerBundle,
      sources: [page.source]
    });
  }

  async bundle(): Promise<PlayerBundle> {
    const { page, files } = await this.#build.result();

    return {
      page,
      files: new Map(files)
    };
  }
}

function playerBundle(
  output: BuildOutput
): PlayerBundle {
  const files = new Map(output.map(
    (file) => [file.fileName, fileBytes(file)]
  ));
  const html = files.get(PLAY_PAGE_PATH);
  if (html === undefined) {
    throw new TypeError(`the player build emitted no ${PLAY_PAGE_PATH}`);
  }
  files.delete(PLAY_PAGE_PATH);

  return {
    page: new TextDecoder().decode(html),
    files
  };
}

function fileBytes(
  file: Rolldown.OutputChunk | Rolldown.OutputAsset
): Uint8Array {
  const content = file.type === "chunk" ? file.code : file.source;

  return typeof content === "string" ?
    new TextEncoder().encode(content) :
    content;
}
