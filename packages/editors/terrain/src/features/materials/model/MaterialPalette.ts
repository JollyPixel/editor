// Import Third-party Dependencies
import { TEXTURE_KIND } from "@jolly-pixel/asset-server";
import type { CatalogClient } from "@jolly-pixel/asset-server/client";
import type {
  TerrainDocument,
  TerrainMaterialChanges,
  TerrainMaterialMap,
  TerrainMaterialMapKind,
  TerrainTextureSize
} from "@jolly-pixel/asset.terrain/client";

// Import Internal Dependencies
import type { MaterialSelection } from "./MaterialSelection.ts";
import {
  parentFolder,
  groupMaterialFiles,
  materialName,
  parseTextureName,
  sameMaterial
} from "./textureNames.ts";
import {
  TERRAIN_HISTORY_SCOPE,
  type TerrainHistory
} from "../../../shared/terrainHistory.ts";

export type MaterialTechnique = "triplanar" | "stochastic" | "heightBlend";

type CatalogRecord = NonNullable<ReturnType<CatalogClient["record"]>>;
type MaterialMaps = Partial<Record<TerrainMaterialMapKind, TerrainMaterialMap>>;

export interface TextureFile {
  readonly name: string;
  readonly bytes: Uint8Array;
}

export interface MaterialPaletteOptions {
  document: Pick<
    TerrainDocument,
    "materials" | "addMaterial" | "updateMaterial" | "removeMaterial" | "changeTextureSize"
  >;
  selection: Pick<MaterialSelection, "select">;
  history: Pick<TerrainHistory, "record">;
  catalog: Pick<CatalogClient, "records" | "record" | "create">;
  importFolder: string;
  pickTexture(title: string): Promise<TerrainMaterialMap | null>;
}

export class MaterialPalette {
  #options: MaterialPaletteOptions;

  constructor(
    options: MaterialPaletteOptions
  ) {
    this.#options = options;
  }

  async addFromPicker(): Promise<string | null> {
    const picked = await this.#options.pickTexture("Pick a texture for the new material");
    const record = picked === null ? undefined : this.#options.catalog.record(picked.id);
    if (record === undefined) {
      return null;
    }

    const { base } = parseTextureName(record.path);

    return this.#add(materialName(base), this.#siblingMaps(record));
  }

  async addFromFiles(
    files: readonly TextureFile[]
  ): Promise<string[]> {
    const added: string[] = [];
    for (const group of groupMaterialFiles(files)) {
      const maps: MaterialMaps = {};
      for (const [kind, file] of Object.entries(group.maps)) {
        maps[kind as TerrainMaterialMapKind] = await this.#import(file);
      }
      const id = this.#add(group.name, maps);
      if (id !== null) {
        added.push(id);
      }
    }

    return added;
  }

  async pickMap(
    materialId: string,
    map: TerrainMaterialMapKind
  ): Promise<boolean> {
    const picked = await this.#options.pickTexture(`Pick the ${map} texture`);

    return picked === null ? false : this.#update(materialId, { [map]: picked });
  }

  async dropMap(
    materialId: string,
    map: TerrainMaterialMapKind,
    file: TextureFile
  ): Promise<boolean> {
    const texture = await this.#import(file);

    return this.#update(materialId, { [map]: texture });
  }

  clearMap(
    materialId: string,
    map: TerrainMaterialMapKind
  ): boolean {
    return this.#update(materialId, { [map]: null });
  }

  rename(
    materialId: string,
    name: string
  ): boolean {
    const trimmed = name.trim();

    return trimmed === "" ? false : this.#update(materialId, { name: trimmed });
  }

  scale(
    materialId: string,
    tiling: number
  ): boolean {
    return this.#update(materialId, { tiling });
  }

  technique(
    materialId: string,
    technique: MaterialTechnique,
    enabled: boolean
  ): boolean {
    return this.#update(materialId, { [technique]: enabled });
  }

  remove(
    materialId: string
  ): boolean {
    const { history, document } = this.#options;

    return history.record(TERRAIN_HISTORY_SCOPE, null, () => document.removeMaterial(materialId));
  }

  changeTextureSize(
    size: TerrainTextureSize
  ): boolean {
    const { history, document } = this.#options;

    return history.record(TERRAIN_HISTORY_SCOPE, null, () => document.changeTextureSize(size));
  }

  #add(
    name: string,
    maps: MaterialMaps
  ): string | null {
    const { history, document, selection } = this.#options;
    const id = history.record(
      TERRAIN_HISTORY_SCOPE,
      null,
      () => document.addMaterial({ name, ...maps })
    );
    if (id !== null) {
      selection.select(id);
    }

    return id;
  }

  #update(
    materialId: string,
    changes: TerrainMaterialChanges
  ): boolean {
    const { history, document } = this.#options;

    return history.record(
      TERRAIN_HISTORY_SCOPE,
      null,
      () => document.updateMaterial(materialId, changes)
    );
  }

  #siblingMaps(
    picked: CatalogRecord
  ): MaterialMaps {
    const maps: MaterialMaps = {
      [parseTextureName(picked.path).map ?? "albedo"]: { id: picked.id, kind: picked.kind }
    };
    const folder = parentFolder(picked.path);
    for (const record of this.#options.catalog.records()) {
      const { map } = parseTextureName(record.path);
      if (
        record.kind === TEXTURE_KIND &&
        map !== null &&
        maps[map] === undefined &&
        parentFolder(record.path) === folder &&
        sameMaterial(record.path, picked.path)
      ) {
        maps[map] = { id: record.id, kind: record.kind };
      }
    }

    return maps;
  }

  async #import(
    file: TextureFile
  ): Promise<TerrainMaterialMap> {
    const { catalog, importFolder } = this.#options;
    const path = importFolder === "" ? file.name : `${importFolder}/${file.name}`;
    const id = await catalog.create(path, file.bytes, {
      kind: TEXTURE_KIND,
      onConflict: "suffix"
    });

    return { id, kind: TEXTURE_KIND };
  }
}
