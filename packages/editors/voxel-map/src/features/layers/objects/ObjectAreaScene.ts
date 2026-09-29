// Import Third-party Dependencies
import * as THREE from "three";
import type { Actor } from "@jolly-pixel/engine";
import { AreaBox } from "@jolly-pixel/three";
import type {
  VoxelObjectJSON,
  VoxelWorld
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  layerKey,
  objectKey,
  parseLayerKey,
  type ObjectRef
} from "../../../state/index.ts";
import type { LayerVisibilityStore } from "../LayerVisibilityStore.ts";
import {
  areaTransformOf,
  colorOf,
  isLocked
} from "./objectArea.ts";

export interface ObjectAreaSceneOptions {
  actor: Actor;
  world: VoxelWorld;
  visibility: Pick<LayerVisibilityStore, "resolve">;
  onRemoving?: (key: string) => void;
}

export class ObjectAreaScene {
  #actor: Actor;
  #world: VoxelWorld;
  #visibility: Pick<LayerVisibilityStore, "resolve">;
  #onRemoving: (key: string) => void;
  #areas = new Map<string, AreaBox>();

  constructor(
    options: ObjectAreaSceneOptions
  ) {
    this.#actor = options.actor;
    this.#world = options.world;
    this.#visibility = options.visibility;
    this.#onRemoving = options.onRemoving ?? (() => void 0);
  }

  get entries(): IterableIterator<[string, AreaBox]> {
    return this.#areas.entries();
  }

  area(
    key: string
  ): AreaBox | undefined {
    return this.#areas.get(key);
  }

  ref(
    key: string
  ): ObjectRef | undefined {
    const ref = parseLayerKey(key);

    return ref.kind === "object" ? ref : undefined;
  }

  object(
    key: string
  ): VoxelObjectJSON | undefined {
    const ref = this.ref(key);
    if (ref === undefined) {
      return undefined;
    }

    return this.#world
      .objectLayers.get(ref.layerName)
      ?.objects.find((candidate) => candidate.id === ref.objectId);
  }

  shown(
    key: string
  ): boolean {
    const ref = this.ref(key);
    const object = this.object(key);
    const layer = ref === undefined ?
      undefined :
      this.#world.objectLayers.get(ref.layerName);
    if (ref === undefined || object === undefined || layer === undefined) {
      return false;
    }

    const layerShown = this.#visibility.resolve(
      layerKey({
        kind: "object-layer",
        name: ref.layerName
      }),
      layer.visible
    );

    return layerShown && this.#visibility.resolve(key, object.visible);
  }

  locked(
    key: string
  ): boolean {
    const object = this.object(key);

    return object !== undefined && isLocked(object);
  }

  syncAll(
    skipKey: string | null = null
  ): void {
    const layers = this.#world.objectLayers.toArray();
    const names = new Set(
      layers.map((layer) => layer.name)
    );

    for (const key of [...this.#areas.keys()]) {
      if (!names.has(this.ref(key)?.layerName ?? "")) {
        this.#remove(key);
      }
    }
    for (const layer of layers) {
      this.syncLayer(layer.name, skipKey);
    }
  }

  syncLayer(
    layerName: string,
    skipKey: string | null = null
  ): void {
    const objects = this.#world.objectLayers.get(
      layerName
    )?.objects ?? [];
    const alive = new Set(
      objects.map((object) => objectKey({
        layerName,
        objectId: object.id
      }))
    );

    for (const key of [...this.#areas.keys()]) {
      if (this.ref(key)?.layerName === layerName && !alive.has(key)) {
        this.#remove(key);
      }
    }
    for (const object of objects) {
      const ref = {
        layerName,
        objectId: object.id
      };
      if (objectKey(ref) !== skipKey) {
        this.#syncObject(ref, object);
      }
    }
  }

  dispose(): void {
    for (const key of [...this.#areas.keys()]) {
      this.#remove(key);
    }
  }

  #syncObject(
    ref: ObjectRef,
    object: VoxelObjectJSON
  ): void {
    const key = objectKey(ref);
    const { position, size } = areaTransformOf(object);
    const area = this.#areas.get(key);

    if (area === undefined) {
      const created = new AreaBox({
        position,
        size,
        color: colorOf(object),
        displayName: object.name
      });
      this.#actor.addChildren(created);
      this.#areas.set(key, created);

      return;
    }

    area.position.set(
      position.x,
      position.y,
      position.z
    );
    area.size = size;

    const color = colorOf(object);
    if (area.color.getHexString() !== new THREE.Color(color).getHexString()) {
      area.color = color;
    }
    if (area.label !== null && area.label.displayName !== object.name) {
      area.label.displayName = object.name;
    }
  }

  #remove(
    key: string
  ): void {
    const area = this.#areas.get(key);
    if (area === undefined) {
      return;
    }

    this.#onRemoving(key);
    this.#actor.removeChildren(area);
    this.#areas.delete(key);
  }
}
