// Import Third-party Dependencies
import {
  AssetCatalog,
  AssetId,
  AssetRecord,
  AssetReference
} from "@jolly-pixel/asset";
import { TEXTURE_ASSET } from "@jolly-pixel/engine";

// Import Internal Dependencies
import { Runtime } from "../../../src/index.ts";

export interface BootOptions {
  runtime?: {
    focusCanvas?: boolean;
    focusHint?: boolean;
    includePerformanceStats?: boolean;
    renderer?: {
      output?: {
        pixelRatio?: number;
      };
    };
  };
  load?: {
    loadingDelay?: number;
    skipLoadingScreen?: boolean;
    textures?: string[];
  };
}

export class RuntimeHarness {
  #runtime: Runtime | null = null;

  get runtime(): Runtime {
    if (this.#runtime === null) {
      throw new Error("The runtime has not been booted.");
    }

    return this.#runtime;
  }

  async boot(
    options: BootOptions = {}
  ): Promise<void> {
    const {
      textures = [],
      ...load
    } = options.load ?? {};

    this.#runtime = await Runtime.create("#game", {
      ...options.runtime,
      assets: {
        catalog: createCatalog(textures)
      }
    });

    await this.#runtime.load({
      ...load,
      assets: textures.map(
        (source) => new AssetReference(new AssetId(source), TEXTURE_ASSET)
      )
    });
  }
}

function createCatalog(
  textures: Iterable<string>
): AssetCatalog {
  const catalog = new AssetCatalog();
  for (const source of textures) {
    catalog.add(new AssetRecord({
      id: new AssetId(source),
      kind: TEXTURE_ASSET.kind,
      source
    }));
  }

  return catalog;
}

window.runtimeE2E = new RuntimeHarness();
