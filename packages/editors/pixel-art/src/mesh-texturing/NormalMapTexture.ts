// Import Third-party Dependencies
import * as THREE from "three";
import type {
  NormalMap,
  Vec2
} from "@jolly-pixel/pixel-draw.renderer";

export class NormalMapTexture {
  readonly texture: THREE.DataTexture;

  readonly #normals: NormalMap;
  readonly #release: () => void;

  constructor(
    normals: NormalMap
  ) {
    this.#normals = normals;
    this.#release = normals.retain();
    normals.flush();

    const { x, y } = normals.size;
    this.texture = new THREE.DataTexture(
      normals.pixels,
      x,
      y,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    );
    this.texture.colorSpace = THREE.NoColorSpace;
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.texture.flipY = true;
    this.texture.needsUpdate = true;

    normals.on("resized", this.#onResized);
    normals.on("changed", this.#onChanged);
  }

  dispose(): void {
    this.#normals.off("resized", this.#onResized);
    this.#normals.off("changed", this.#onChanged);
    this.#release();
    this.texture.dispose();
  }

  readonly #onResized = (
    event: { size: Vec2; }
  ): void => {
    this.texture.image = {
      data: this.#normals.pixels,
      width: event.size.x,
      height: event.size.y
    };
    this.texture.dispose();
  };

  readonly #onChanged = (): void => {
    this.texture.needsUpdate = true;
  };
}
