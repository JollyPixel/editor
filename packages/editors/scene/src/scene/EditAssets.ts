// Import Third-party Dependencies
import type {
  AssetReferenceData,
  AssetType
} from "@jolly-pixel/asset";
import type { Systems } from "@jolly-pixel/engine";
import type { VoxelView } from "@jolly-pixel/voxel.renderer";
import {
  VOXEL_MAP_ASSET,
  type VoxelMapSource
} from "@jolly-pixel/voxel.renderer/engine";

export interface MapViewer extends VoxelMapSource {
  release(): void;
}

export type MapViewerOpener = (mapId: string) => MapViewer;

interface SharedMap {
  viewer: MapViewer;
  views: number;
}

export class EditAssets implements Systems.ComponentAssetResolver {
  #openMap: MapViewerOpener;
  #maps = new Map<string, SharedMap>();
  #disposed = false;

  constructor(
    openMap: MapViewerOpener
  ) {
    this.#openMap = openMap;
  }

  resolve<TValue>(
    reference: AssetReferenceData,
    type: AssetType<TValue>
  ): TValue {
    if (type.kind !== VOXEL_MAP_ASSET.kind) {
      throw new Error(
        `EditAssets: the scene editor resolves no "${type.kind}" asset.`
      );
    }

    return this.#source(reference.id) as TValue;
  }

  dispose(): void {
    this.#disposed = true;
    for (const shared of this.#maps.values()) {
      shared.viewer.release();
    }
    this.#maps.clear();
  }

  #source(
    mapId: string
  ): VoxelMapSource {
    const shared = this.#shared(mapId);

    return {
      document: shared.viewer.document,
      attach: (view: VoxelView) => {
        shared.views++;
        const detach = shared.viewer.attach(view);

        return () => {
          detach();
          shared.views--;
          queueMicrotask(() => this.#releaseUnused(mapId, shared));
        };
      }
    };
  }

  #shared(
    mapId: string
  ): SharedMap {
    let shared = this.#maps.get(mapId);
    if (shared === undefined) {
      shared = {
        viewer: this.#openMap(mapId),
        views: 0
      };
      this.#maps.set(mapId, shared);
    }

    return shared;
  }

  #releaseUnused(
    mapId: string,
    shared: SharedMap
  ): void {
    if (
      this.#disposed ||
      shared.views > 0 ||
      this.#maps.get(mapId) !== shared
    ) {
      return;
    }

    this.#maps.delete(mapId);
    shared.viewer.release();
  }
}
