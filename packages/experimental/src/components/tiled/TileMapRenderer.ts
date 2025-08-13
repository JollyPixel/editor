// Import Third-party Dependencies
import { Actor, ActorComponent, Systems } from "@jolly-pixel/engine";
import * as THREE from "three";

// Import Internal Dependencies
import {
  tiledMapLoader,
  type LoadedTileMapAsset
} from "./loader.js";
import type { TiledMap, TiledObject } from "./types.js";
import { TileSet } from "./TileSet.js";
import { TileLayer } from "./TileLayer.js";

export interface TileMapRendererOptions {
  assetPath: string;
}

export class TileMapRenderer extends ActorComponent {
  #map: Systems.LazyAsset<LoadedTileMapAsset>;

  constructor(
    actor: Actor,
    options: TileMapRendererOptions
  ) {
    super({
      actor,
      typeName: "TileMapRenderer"
    });

    this.#map = tiledMapLoader(options.assetPath);
  }

  awake() {
    const { tilemap, tilesets: rawTileSets } = this.#map.get();
    const tilesets = [...rawTileSets.values()].map(
      ({ tileset, texture }) => new TileSet(tileset, texture)
    );

    this.#generateLayers(tilemap, tilesets);
    this.#generateObjects(tilemap);
  }

  #generateLayers(
    tilemap: TiledMap,
    tilesets: TileSet[]
  ) {
    for (const layer of TileLayer.fromTileMap(tilemap)) {
      for (const { tileId, position } of layer) {
        const texture = TileSet.find(tilesets, tileId)?.getTileTexture(tileId) ?? null;

        const cube = new TileMapCube(texture);
        cube.position.set(position.x, position.y, position.z);
        this.actor.threeObject.add(cube);
      }
    }
  }

  #generateObjects(
    tilemap: TiledMap
  ) {
    let zIndex = 0;
    for (const layer of tilemap.layers) {
      if (layer.type !== "objectgroup") {
        continue;
      }
      zIndex++;

      for (const object of layer.objects) {
        const childrenActor = new Actor(this.actor.gameInstance, {
          name: object.name,
          parent: this.actor
        });
        childrenActor.threeObject.position.set(
          object.x / tilemap.tilewidth,
          object.y / tilemap.tileheight,
          zIndex
        );

        if (object.rotation !== 0) {
          const rotationRadians = (object.rotation * Math.PI) / 180;
          childrenActor.threeObject.rotation.z = -rotationRadians;
        }

        if (object.width > 0 && object.height > 0) {
          const visualBox = this.#createObjectVisualization(object, tilemap);
          childrenActor.threeObject.add(visualBox);
        }
      }
    }
  }

  #createObjectVisualization(
    object: TiledObject,
    tilemap: TiledMap
  ) {
    const width = object.width / tilemap.tilewidth;
    const height = object.height / tilemap.tileheight;

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

class TileMapCube extends THREE.Mesh {
  static SIZE = 1;

  constructor(
    texture: THREE.Texture | null
  ) {
    super();

    if (texture) {
      this.material = new THREE.MeshPhongMaterial({
        map: texture
      });
      this.material.transparent = true;
    }
    else {
      this.material = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0xffffff)
      });
    }

    this.geometry = new THREE.BoxGeometry(
      TileMapCube.SIZE,
      TileMapCube.SIZE,
      TileMapCube.SIZE
    );
  }
}
