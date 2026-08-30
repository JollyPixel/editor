// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { TilesetDefinition } from "./types.ts";

export interface TilesetSource {
  def: TilesetDefinition;
  texture: THREE.Texture<HTMLImageElement>;
}

export interface TextureSourceLoader {
  loadAsync(
    url: string
  ): Promise<THREE.Texture<HTMLImageElement>>;
}

export interface LoadTilesetsOptions {
  manager?: THREE.LoadingManager;
  loader?: TextureSourceLoader;
}

/**
 * Fetches atlas textures so they can be registered synchronously
 */
export function loadTilesets(
  definitions: Iterable<TilesetDefinition>,
  options: LoadTilesetsOptions = {}
): Promise<TilesetSource[]> {
  const {
    manager,
    loader = new THREE.TextureLoader(manager)
  } = options;

  const unique = new Map<string, TilesetDefinition>();
  for (const def of definitions) {
    if (!unique.has(def.id)) {
      unique.set(def.id, def);
    }
  }

  return Promise.all(
    [...unique.values()].map(
      async(def) => {
        return {
          def,
          texture: await loader.loadAsync(def.src)
        };
      }
    )
  );
}
