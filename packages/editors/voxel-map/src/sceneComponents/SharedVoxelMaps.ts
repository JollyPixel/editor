// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";
import type { SceneAssetResolver } from "@jolly-pixel/editor.host/scene";
import type { VoxelView } from "@jolly-pixel/voxel.renderer";
import type { VoxelMapSource } from "@jolly-pixel/voxel.renderer/engine";

export interface MapViewer extends VoxelMapSource {
  release(): void;
}

export type MapViewerOpener = (mapId: string) => MapViewer;

interface SharedMap {
  viewer: MapViewer;
  views: number;
}

export class SharedVoxelMaps implements SceneAssetResolver<VoxelMapSource> {
  #openMap: MapViewerOpener;
  #maps = new Map<string, SharedMap>();
  #disposed = false;

  constructor(
    openMap: MapViewerOpener
  ) {
    this.#openMap = openMap;
  }

  resolve(
    reference: AssetReferenceData
  ): VoxelMapSource {
    const mapId = reference.id;
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

  dispose(): void {
    this.#disposed = true;
    for (const shared of this.#maps.values()) {
      shared.viewer.release();
    }
    this.#maps.clear();
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
