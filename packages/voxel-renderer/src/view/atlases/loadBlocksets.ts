// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type {
  BlocksetDefinition,
  AtlasNormalTexture
} from "../../document/blocksets/types.ts";

export interface AtlasSource {
  def: BlocksetDefinition;
  texture: THREE.Texture<HTMLImageElement>;
  normal?: AtlasNormalTexture;
}

export interface TextureSourceLoader {
  loadAsync(
    url: string
  ): Promise<THREE.Texture<HTMLImageElement>>;
}

export interface LoadBlocksetsOptions {
  manager?: THREE.LoadingManager;
  loader?: TextureSourceLoader;
}

/**
 * Fetches atlas textures so they can be registered synchronously
 */
export function loadBlocksets(
  definitions: Iterable<BlocksetDefinition>,
  options: LoadBlocksetsOptions = {}
): Promise<AtlasSource[]> {
  const {
    manager,
    loader = new THREE.TextureLoader(manager)
  } = options;

  const unique = new Map<string, BlocksetDefinition & { src: string; }>();
  for (const def of definitions) {
    if (def.src !== undefined && !unique.has(def.id)) {
      unique.set(def.id, {
        ...def,
        src: def.src
      });
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
