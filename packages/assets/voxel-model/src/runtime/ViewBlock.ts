// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { UVRegion } from "@jolly-pixel/pixel-draw.renderer";
import { UVGeometryBinding } from "@jolly-pixel/asset.pixel-art/runtime";

// Import Internal Dependencies
import {
  MaterialSurface,
  type BlockNodeJSON,
  type MaterialSurfaceJSON
} from "../model/index.ts";
import { BlockBody } from "./blocks/BlockBody.ts";
import { paintBlockMaterial } from "./blocks/paintBlockSurface.ts";
import type { ModelViewTexture } from "./ModelView.ts";

// CONSTANTS
const kRegionColor = "#ffffff";

export class ViewBlock extends BlockBody {
  readonly #texture: ModelViewTexture;
  #uv: UVGeometryBinding;

  constructor(
    block: BlockNodeJSON,
    texture: ModelViewTexture
  ) {
    super({
      shape: block.shape,
      flip: block.flipAxes,
      size: new THREE.Vector3().copy(block.transform.size),
      texture: texture.map
    });
    this.node.uuid = block.id;
    this.#texture = texture;
    this.#uv = this.#bind(block);
  }

  update(
    block: BlockNodeJSON,
    surface: MaterialSurfaceJSON | null
  ): void {
    const rebuilt = this.rebuild({
      shape: block.shape,
      flip: block.flipAxes
    });
    this.transform = block.transform;
    if (rebuilt) {
      this.#uv = this.#bind(block);
    }
    else {
      this.#uv.resizeTexture(this.#texture.size());
      this.#uv.bindRegion(blockRegion(block));
    }
    paintBlockMaterial(
      this.mesh.material,
      surface ?? MaterialSurface.create()
    );
  }

  #bind(
    block: BlockNodeJSON
  ): UVGeometryBinding {
    this.restoreBaseUv();

    return new UVGeometryBinding({
      geometry: this.mesh.geometry,
      region: blockRegion(block),
      textureSize: this.#texture.size(),
      faceRanges: this.faces
    });
  }
}

function blockRegion(
  block: BlockNodeJSON
): UVRegion {
  return UVRegion.fromLayout(block.uv, {
    id: block.id,
    color: kRegionColor
  });
}
