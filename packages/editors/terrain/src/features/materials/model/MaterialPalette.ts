// Import Third-party Dependencies
import { TEXTURE_KIND } from "@jolly-pixel/asset-server";
import type { CatalogClient } from "@jolly-pixel/asset-server/client";
import type {
  TerrainDocument,
  TerrainMaterialChanges,
  TerrainMaterialMap,
  TerrainTextureSize
} from "@jolly-pixel/asset.terrain/client";
import type {
  MaterialMap,
  MaterialTechnique
} from "@jolly-pixel/terrain.renderer";

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

export type TextureConflict = "replace" | "keep";

type CatalogRecord = NonNullable<ReturnType<CatalogClient["record"]>>;
type MaterialMaps = Partial<Record<MaterialMap, TerrainMaterialMap>>;

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
  catalog: Pick<CatalogClient, "records" | "record" | "create" | "replace">;
  importFolder: string;
  pickTexture(title: string): Promise<TerrainMaterialMap | null>;
  askConflict(paths: readonly string[]): Promise<TextureConflict | null>;
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

    return this.#select(this.#add(materialName(base), this.#siblingMaps(record)));
  }

  async addFromFiles(
    files: readonly TextureFile[]
  ): Promise<string[]> {
    const conflict = await this.#conflict(files);
    if (conflict === null) {
      return [];
    }

    const added: string[] = [];
    for (const group of groupMaterialFiles(files)) {
      const maps: MaterialMaps = {};
      for (const [kind, file] of Object.entries(group.maps)) {
        maps[kind as MaterialMap] = await this.#import(file, conflict);
      }
      const id = this.#select(this.#materialUsing(maps) ?? this.#add(group.name, maps));
      if (id !== null) {
        added.push(id);
      }
    }

    return added;
  }

  async pickMap(
    materialId: string,
    map: MaterialMap
  ): Promise<boolean> {
    const picked = await this.#options.pickTexture(`Pick the ${map} texture`);

    return picked === null ? false : this.#update(materialId, { [map]: picked });
  }

  async dropMap(
    materialId: string,
    map: MaterialMap,
    file: TextureFile
  ): Promise<boolean> {
    const conflict = await this.#conflict([file]);
    if (conflict === null) {
      return false;
    }

    const texture = await this.#import(file, conflict);
    const current = this.#options.document.materials.material(materialId)?.[map];

    return current?.id === texture.id || this.#update(materialId, { [map]: texture });
  }

  clearMap(
    materialId: string,
    map: MaterialMap
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
    return this.#record((document) => document.removeMaterial(materialId));
  }

  changeTextureSize(
    size: TerrainTextureSize
  ): boolean {
    return this.#record((document) => document.changeTextureSize(size));
  }

  #add(
    name: string,
    maps: MaterialMaps
  ): string | null {
    return this.#record((document) => document.addMaterial({ name, ...maps }));
  }

  #update(
    materialId: string,
    changes: TerrainMaterialChanges
  ): boolean {
    return this.#record((document) => document.updateMaterial(materialId, changes));
  }

  #record<T>(
    edit: (document: MaterialPaletteOptions["document"]) => T
  ): T {
    const { history, document } = this.#options;

    return history.record(TERRAIN_HISTORY_SCOPE, null, () => edit(document));
  }

  #select(
    materialId: string | null
  ): string | null {
    if (materialId !== null) {
      this.#options.selection.select(materialId);
    }

    return materialId;
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

  #materialUsing(
    maps: MaterialMaps
  ): string | null {
    const used = Object.entries(maps);
    const material = this.#options.document.materials.materials().find(
      (candidate) => used.every(([kind, map]) => candidate[kind as MaterialMap]?.id === map.id)
    );

    return material?.id ?? null;
  }

  async #conflict(
    files: readonly TextureFile[]
  ): Promise<TextureConflict | null> {
    const existing = files
      .map((file) => this.#importPath(file))
      .filter((path) => this.#textureAt(path) !== undefined);

    return existing.length === 0 ? "keep" : this.#options.askConflict(existing);
  }

  async #import(
    file: TextureFile,
    conflict: TextureConflict
  ): Promise<TerrainMaterialMap> {
    const { catalog } = this.#options;
    const path = this.#importPath(file);
    const existing = this.#textureAt(path);
    if (existing !== undefined && conflict === "replace") {
      await catalog.replace(existing.id, file.bytes);

      return { id: existing.id, kind: TEXTURE_KIND };
    }

    const id = await catalog.create(path, file.bytes, {
      kind: TEXTURE_KIND,
      onConflict: "suffix"
    });

    return { id, kind: TEXTURE_KIND };
  }

  #importPath(
    file: TextureFile
  ): string {
    const { importFolder } = this.#options;

    return importFolder === "" ? file.name : `${importFolder}/${file.name}`;
  }

  #textureAt(
    path: string
  ): CatalogRecord | undefined {
    return [...this.#options.catalog.records()].find(
      (record) => record.kind === TEXTURE_KIND && record.path === path
    );
  }
}
