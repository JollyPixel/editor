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
  areaTransformOf,
  colorOf,
  isLocked,
  objectKey,
  parseObjectKey
} from "./objectArea.ts";

export interface ObjectAreaSceneOptions {
  actor: Actor;
  world: VoxelWorld;
  onRemoving?: (key: string) => void;
}

/**
 * Maintains the Three.js area objects projected from object-layer data.
 */
export class ObjectAreaScene {
  #actor: Actor;
  #world: VoxelWorld;
  #onRemoving: (key: string) => void;
  #areas = new Map<string, AreaBox>();

  constructor(
    options: ObjectAreaSceneOptions
  ) {
    this.#actor = options.actor;
    this.#world = options.world;
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

  object(
    key: string
  ): VoxelObjectJSON | undefined {
    const { layerName, objectId } = parseObjectKey(key);

    return this.#world
      .getObjectLayer(layerName)
      ?.objects.find((candidate) => candidate.id === objectId);
  }

  shown(
    key: string
  ): boolean {
    const object = this.object(key);
    if (object === undefined) {
      return false;
    }

    const { layerName } = parseObjectKey(key);

    return this.#world.getObjectLayer(layerName)?.visible === true &&
      object.visible;
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
    const layers = this.#world.getObjectLayers();
    const names = new Set(
      layers.map((layer) => layer.name)
    );

    for (const key of [...this.#areas.keys()]) {
      if (!names.has(parseObjectKey(key).layerName)) {
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
    const objects = this.#world.getObjectLayer(
      layerName
    )?.objects ?? [];
    const alive = new Set(
      objects.map((object) => objectKey(layerName, object.id))
    );

    for (const key of [...this.#areas.keys()]) {
      if (
        parseObjectKey(key).layerName === layerName &&
        !alive.has(key)
      ) {
        this.#remove(key);
      }
    }
    for (const object of objects) {
      const key = objectKey(layerName, object.id);
      if (key !== skipKey) {
        this.#syncObject(layerName, object);
      }
    }
  }

  dispose(): void {
    for (const key of [...this.#areas.keys()]) {
      this.#remove(key);
    }
  }

  #syncObject(
    layerName: string,
    object: VoxelObjectJSON
  ): void {
    const key = objectKey(layerName, object.id);
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
