// Import Third-party Dependencies
import { AssetPath } from "@jolly-pixel/asset";
import type {
  AssetArchive,
  AssetArchiveAsset
} from "@jolly-pixel/asset-server";
import {
  SCENE_FILE,
  SCENE_KIND,
  type JSONObject,
  type SceneActorJSON,
  type SceneEnvironmentJSON,
  type SceneFile,
  type Vector3JSON
} from "@jolly-pixel/asset.scene";

export interface SceneComponentRow {
  type: string;
  data: JSONObject;
}

export interface SceneActorRow {
  path: string;
  components: SceneComponentRow[];
  position: Vector3JSON;
  scale: Vector3JSON;
  visible: boolean;
  assets?: string[];
  prefab?: string;
  overrides?: string[];
}

export interface SceneExpectation {
  open: string;
  scenes: Record<string, SceneActorRow[]>;
  environment: SceneEnvironmentJSON;
  assets: string[];
}

export class SceneArchive {
  readonly #archive: AssetArchive;
  readonly #names = new Map<string, string>();
  readonly #scenes = new Map<AssetArchiveAsset, SceneFile>();
  readonly #files = new Map<string, SceneFile>();

  constructor(
    archive: AssetArchive
  ) {
    this.#archive = archive;
    for (const asset of archive.assets) {
      if (asset.kind !== SCENE_KIND) {
        this.#names.set(asset.id, asset.kind);
        continue;
      }

      const file = SCENE_FILE.decode(asset.data);
      this.#scenes.set(asset, file);
      this.#files.set(asset.id, file);
      this.#names.set(asset.id, assetName(asset));
    }
  }

  describe(): SceneExpectation {
    const root = this.#archive.assets.find(
      (asset) => asset.id === this.#archive.root?.id
    );
    const rootFile = root === undefined ? undefined : this.#scenes.get(root);
    if (root === undefined || rootFile === undefined) {
      throw new Error("The archive root is not a scene.");
    }

    const scenes: Record<string, SceneActorRow[]> = {};
    for (const [asset, file] of this.#scenes) {
      scenes[assetName(asset)] = this.#rows(file);
    }
    const assets = this.#archive.assets
      .filter((asset) => asset.kind !== SCENE_KIND)
      .map((asset) => asset.kind);

    return {
      open: assetName(root),
      scenes,
      environment: rootFile.environment,
      assets: assets.sort()
    };
  }

  #rows(
    file: SceneFile
  ): SceneActorRow[] {
    const paths = new Map<string, string>();
    const rows: SceneActorRow[] = [];
    for (const actor of file.actors) {
      const parent = actor.parentId === null ?
        undefined :
        paths.get(actor.parentId);
      const path = parent === undefined ? actor.name : `${parent}/${actor.name}`;
      paths.set(actor.id, path);
      rows.push(this.#row(path, actor));
    }

    return rows;
  }

  #row(
    path: string,
    actor: SceneActorJSON
  ): SceneActorRow {
    const assets = actor.components.flatMap(
      (component) => Object.values(component.assets).map(
        (reference) => (reference === null ? "empty" : this.#name(reference.id))
      )
    );
    const overrides = [
      ...Object.keys(actor.overrides?.actors ?? {}),
      ...Object.keys(actor.overrides?.components ?? {})
    ].map((key) => this.#overridePath(actor.prefab?.id, key));

    return {
      path,
      components: actor.components.map(({ type, data }) => {
        return { type, data };
      }),
      position: rounded(actor.transform.position),
      scale: rounded(actor.transform.scale),
      visible: actor.visible,
      ...(assets.length === 0 ? {} : { assets }),
      ...(actor.prefab === undefined ? {} : {
        prefab: this.#name(actor.prefab.id)
      }),
      ...(overrides.length === 0 ? {} : { overrides: overrides.sort() })
    };
  }

  #overridePath(
    prefabId: string | undefined,
    key: string
  ): string {
    const names: string[] = [];
    let sceneId = prefabId;
    for (const id of key.split("/")) {
      const actors = (sceneId === undefined ? undefined : this.#files.get(sceneId))?.actors ?? [];
      const actor = actors.find((candidate) => candidate.id === id);
      const component = actors
        .flatMap((candidate) => candidate.components)
        .find((candidate) => candidate.id === id);
      names.push(actor?.name ?? component?.type ?? `missing:${id}`);
      sceneId = actor?.prefab?.id;
    }

    return names.join("/");
  }

  #name(
    id: string
  ): string {
    return this.#names.get(id) ?? `missing:${id}`;
  }
}

function assetName(
  asset: AssetArchiveAsset
): string {
  return new AssetPath(asset.path).withoutExtension().toString();
}

function rounded(
  vector: Vector3JSON
): Vector3JSON {
  return {
    x: round(vector.x),
    y: round(vector.y),
    z: round(vector.z)
  };
}

function round(
  value: number
): number {
  return Math.round(value * 1000) / 1000 + 0;
}
