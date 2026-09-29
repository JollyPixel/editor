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
  ObjectRef,
  parseLayerRef
} from "../../../state/index.ts";
import type { LayerVisibilityStore } from "../LayerVisibilityStore.ts";
import { MapObject } from "./MapObject.ts";

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
    const ref = parseLayerRef(key);

    return ref instanceof ObjectRef ? ref : undefined;
  }

  object(
    key: string
  ): VoxelObjectJSON | undefined {
    return this.ref(key)?.objectIn(this.#world);
  }

  shown(
    key: string
  ): boolean {
    const ref = this.ref(key);
    const object = ref?.objectIn(this.#world);
    const layer = ref === undefined ?
      undefined :
      this.#world.objectLayers.get(ref.layerName);
    if (ref === undefined || object === undefined || layer === undefined) {
      return false;
    }

    return this.#visibility.resolve(ref.layer.key, layer.visible) &&
      this.#visibility.resolve(key, object.visible);
  }

  locked(
    key: string
  ): boolean {
    const object = this.object(key);

    return object !== undefined && new MapObject(object).locked;
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
      objects.map((object) => new ObjectRef(layerName, object.id).key)
    );

    for (const key of [...this.#areas.keys()]) {
      if (this.ref(key)?.layerName === layerName && !alive.has(key)) {
        this.#remove(key);
      }
    }
    for (const object of objects) {
      const key = new ObjectRef(layerName, object.id).key;
      if (key !== skipKey) {
        this.#syncObject(key, new MapObject(object));
      }
    }
  }

  dispose(): void {
    for (const key of [...this.#areas.keys()]) {
      this.#remove(key);
    }
  }

  #syncObject(
    key: string,
    object: MapObject
  ): void {
    const { position, size } = object.area;
    const area = this.#areas.get(key);

    if (area === undefined) {
      const created = new AreaBox({
        position,
        size,
        color: object.color,
        displayName: object.data.name
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

    const { color } = object;
    if (area.color.getHexString() !== new THREE.Color(color).getHexString()) {
      area.color = color;
    }
    if (area.label !== null && area.label.displayName !== object.data.name) {
      area.label.displayName = object.data.name;
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
