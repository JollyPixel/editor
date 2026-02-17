// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import * as Systems from "../../../systems/index.ts";
import { Actor, ActorComponent } from "../../../actor/index.ts";
import { TileSet } from "./TileSet.ts";
import { TileObject } from "./TileObject.ts";
import { TileLayer } from "./TileLayer.ts";
import { tiledMap, type TiledMapAsset } from "./loader.ts";

export type TiledMapOrientation = "top-down" | "platformer";

export interface TiledMapRendererOptions {
  assetPath: string;
  /**
   * @default "platformer"
   */
  orientation?: TiledMapOrientation;
}

export class TiledMapRenderer extends ActorComponent<any> {
  #map: Systems.LazyAsset<TiledMapAsset>;
  #orientation: TiledMapOrientation;

  constructor(
    actor: Actor<any>,
    options: TiledMapRendererOptions
  ) {
    const {
      assetPath,
      orientation = "platformer"
    } = options;

    super({
      actor,
      typeName: "TiledMapRenderer"
    });

    this.#map = tiledMap(assetPath);
    this.#orientation = orientation;
  }

  awake() {
    const { tilemap, tilesets: rawTileSets } = this.#map.get();
    const tilesets = [...rawTileSets.values()].map(
      ({ tileset, texture }) => new TileSet(tileset, texture)
    );

    for (const layer of TileLayer.fromTileMap(tilemap)) {
      for (const { tileId, position } of layer) {
        const texture = TileSet.find(tilesets, tileId)?.getTileTexture(tileId) ?? null;

        const cube = new TileMapCube(texture);
        cube.position.set(position.x, position.y, position.z);
        this.actor.threeObject.add(cube);
      }
    }

    for (const layer of TileObject.fromTileMap(tilemap)) {
      layer.createActors(this.actor);
    }

    if (this.#orientation === "top-down") {
      this.actor.threeObject.rotateX(-Math.PI / 2);
    }
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
