// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import * as loaders from "../../loaders/index.js";
import { Actor } from "../../Actor.js";
import { ActorComponent } from "../../ActorComponent.js";
import * as Systems from "../../systems/index.js";
import { TileSet } from "./TileSet.js";
import { TileObject } from "./TileObject.js";
import { TileLayer } from "./TileLayer.js";

export type TileMapOrientation = "top-down" | "platformer";

export interface TileMapRendererOptions {
  assetPath: string;
  /**
   * @default "platformer"
   */
  orientation?: TileMapOrientation;
}

export class TileMapRenderer extends ActorComponent {
  #map: Systems.LazyAsset<loaders.TiledMapAsset>;
  #orientation: TileMapOrientation;

  constructor(
    actor: Actor,
    options: TileMapRendererOptions
  ) {
    const {
      assetPath,
      orientation = "platformer"
    } = options;

    super({
      actor,
      typeName: "TiledMapRenderer"
    });

    this.#map = loaders.tiledMap(assetPath);
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
