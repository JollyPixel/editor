// Import Internal Dependencies
import { tileUvRegion } from "../atlases/BlocksetAtlas.ts";
import { MISSING_BLOCKSET_DEFINITION } from "../../document/blocksets/missingBlockset.ts";
import type { ResolvedBlocksetDefinition } from "../../document/blocksets/types.ts";
import type {
  BlocksetResolver,
  AtlasUvSource
} from "../meshing/variants/types.ts";
import type { MeshBlocksetDefinitions } from "./MeshDefinitions.ts";

class DefinedBlockset implements AtlasUvSource {
  readonly def: ResolvedBlocksetDefinition;

  constructor(
    def: ResolvedBlocksetDefinition
  ) {
    this.def = def;
  }

  uvFor(
    ...args: Parameters<AtlasUvSource["uvFor"]>
  ): ReturnType<AtlasUvSource["uvFor"]> {
    return tileUvRegion(this.def, ...args);
  }
}

export class DefinedBlocksets implements BlocksetResolver {
  readonly version = 0;

  #defaultBlocksetId: string | null;
  #declared: Set<string>;
  #loaded = new Map<string, DefinedBlockset>();
  #missing = new DefinedBlockset(MISSING_BLOCKSET_DEFINITION);

  constructor(
    definitions: MeshBlocksetDefinitions
  ) {
    this.#defaultBlocksetId = definitions.defaultBlocksetId;
    this.#declared = new Set(definitions.declared);
    for (const def of definitions.loaded) {
      this.#loaded.set(def.id, new DefinedBlockset(def));
    }
  }

  resolve(
    blocksetId?: string
  ): AtlasUvSource | undefined {
    const id = blocksetId ?? this.#defaultBlocksetId;
    if (id !== null && this.#declared.has(id)) {
      return this.#loaded.get(id);
    }

    return this.#missing;
  }
}
