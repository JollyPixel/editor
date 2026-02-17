// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { Actor } from "../../../actor/Actor.ts";
import type {
  TiledMap,
  TiledObject,
  TiledObjectLayer
} from "./types.ts";

export interface TileObjectOptions {
  zIndex: number;
  width: number;
  height: number;
}

export class TileObject {
  static* fromTileMap(
    map: TiledMap
  ) {
    for (const layer of map.layers) {
      if (layer.type === "objectgroup") {
        yield new TileObject(layer, {
          zIndex: 1,
          width: map.tilewidth,
          height: map.tileheight
        });
      }
    }
  }

  layer: TiledObjectLayer;
  zIndex: number;
  width: number;
  height: number;

  constructor(
    layer: TiledObjectLayer,
    options: TileObjectOptions
  ) {
    this.layer = layer;
    this.zIndex = options.zIndex;
    this.width = options.width;
    this.height = options.height;
  }

  createActors(
    parent: Actor<any>
  ) {
    for (const object of this.layer.objects) {
      const childrenActor = new Actor(parent.world, {
        name: object.name,
        parent
      });
      childrenActor.object3D.position.set(
        object.x / this.width,
        object.y / this.height,
        this.zIndex
      );

      if (object.rotation !== 0) {
        const rotationRadians = (object.rotation * Math.PI) / 180;
        childrenActor.object3D.rotation.z = -rotationRadians;
      }

      if (object.width > 0 && object.height > 0) {
        const visualBox = this.#createObjectVisualization(object);
        childrenActor.object3D.add(visualBox);
      }
    }
  }

  #createObjectVisualization(
    object: TiledObject
  ) {
    const width = object.width / this.width;
    const height = object.height / this.height;

    const geometry = new THREE.BoxGeometry(
      width,
      height,
      0.1
    );

    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 1,
      wireframe: true
    });

    const box = new THREE.Mesh(geometry, material);
    box.position.set(width / 2, height / 2, 0);

    return box;
  }
}
