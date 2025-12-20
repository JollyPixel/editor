// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type {
  TiledMap,
  TiledTileLayer
} from "./types.ts";

export class TileLayer {
  static* fromTileMap(
    map: TiledMap
  ) {
    let zId = 0;
    for (const layer of map.layers) {
      if (layer.type === "tilelayer") {
        yield new TileLayer(layer, zId);
        zId++;
      }
    }
  }

  layer: TiledTileLayer;
  zIndex: number;

  constructor(
    layer: TiledTileLayer,
    zIndex = 0
  ) {
    this.layer = layer;
    this.zIndex = zIndex;
  }

  * [Symbol.iterator]() {
    for (let x = 0; x < this.layer.width; x++) {
      for (let y = 0; y < this.layer.height; y++) {
        const tileIndex = (y * this.layer.width) + x;
        const tileId = Number(this.layer.data[tileIndex]);

        if (tileId !== 0) {
          yield {
            tileId,
            position: new THREE.Vector3(x, y, this.zIndex)
          };
        }
      }
    }
  }
}
