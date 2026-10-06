// Import Internal Dependencies
import type {
  AtlasNormalTexture,
  AtlasTexture
} from "../../document/blocksets/types.ts";
import { AtlasAverages } from "./AtlasAverages.ts";
import { BlocksetAtlas } from "./BlocksetAtlas.ts";
import { BlocksetList } from "../../document/blocksets/BlocksetList.ts";
import {
  createMissingBlocksetAtlas,
  type MissingBlocksetAtlas
} from "./missingBlocksetAtlas.ts";

export interface BlocksetAtlasesOptions {
  blocksets?: BlocksetList;
}

export class BlocksetAtlases {
  readonly blocksets: BlocksetList;

  #atlases = new Map<string, BlocksetAtlas>();
  #missing: MissingBlocksetAtlas | null = null;
  #version = 0;

  constructor(
    options: BlocksetAtlasesOptions = {}
  ) {
    this.blocksets = options.blocksets ?? new BlocksetList();
  }

  get version(): number {
    return this.#version + this.blocksets.version;
  }

  get defaultBlocksetId(): string | null {
    return this.blocksets.defaultBlocksetId;
  }

  registerTexture(
    blocksetId: string,
    texture: AtlasTexture,
    normal: AtlasNormalTexture | null = null
  ): BlocksetAtlas {
    const declared = this.blocksets.get(blocksetId);
    if (declared === undefined) {
      throw new Error(
        `BlocksetAtlases: blockset "${blocksetId}" is not declared.`
      );
    }

    const atlas = new BlocksetAtlas(declared, texture, normal);
    this.#atlases.get(blocksetId)?.disposeReplacedBy(atlas);
    this.#atlases.set(blocksetId, atlas);
    this.#version++;

    return atlas;
  }

  syncAtlases(): string[] {
    const changed: string[] = [];
    for (const [blocksetId, atlas] of this.#atlases) {
      const declared = this.blocksets.get(blocksetId);
      if (declared === undefined) {
        atlas.dispose();
        this.#atlases.delete(blocksetId);
        changed.push(blocksetId);
      }
      else if (
        declared.tileSize !== undefined &&
        declared.tileSize !== atlas.def.tileSize
      ) {
        this.#atlases.set(
          blocksetId,
          new BlocksetAtlas(declared, atlas.texture, atlas.normal)
        );
        changed.push(blocksetId);
      }
    }
    if (changed.length > 0) {
      this.#version++;
    }

    return changed;
  }

  get(
    blocksetId?: string
  ): BlocksetAtlas | undefined {
    const id = blocksetId ?? this.defaultBlocksetId;

    return id === null ? undefined : this.#atlases.get(id);
  }

  resolve(
    blocksetId?: string
  ): BlocksetAtlas | MissingBlocksetAtlas | undefined {
    const id = blocksetId ?? this.defaultBlocksetId;
    if (id !== null && this.blocksets.has(id)) {
      return this.#atlases.get(id);
    }

    this.#missing ??= createMissingBlocksetAtlas();

    return this.#missing;
  }

  atlas(
    blocksetId?: string
  ): BlocksetAtlas {
    const id = blocksetId ?? this.defaultBlocksetId;
    if (id === null) {
      throw new Error("BlocksetAtlases: no blocksets have been loaded.");
    }

    const atlas = this.#atlases.get(id);
    if (!atlas) {
      throw new Error(`BlocksetAtlases: blockset "${id}" is not loaded.`);
    }

    return atlas;
  }

  refreshAverages(): void {
    for (const atlas of this.#atlases.values()) {
      AtlasAverages.peek(atlas.texture)?.refresh();
    }
  }

  dispose(): void {
    for (const atlas of this.#atlases.values()) {
      atlas.dispose();
    }
    this.#atlases.clear();
    this.#missing?.dispose();
    this.#missing = null;
    this.#version++;
  }
}
