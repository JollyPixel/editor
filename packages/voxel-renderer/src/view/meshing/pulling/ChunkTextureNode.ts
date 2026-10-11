// Import Third-party Dependencies
import * as THREE from "three";
import {
  NodeUpdateType,
  TextureNode,
  type Node,
  type NodeBuilder,
  type NodeFrame
} from "three/webgpu";

// Import Internal Dependencies
import { PulledChunkGeometry } from "./PulledChunkGeometry.ts";

/**
 * Binds, per drawn object, a texture its pulled chunk geometry owns.
 */
export abstract class ChunkTextureNode extends TextureNode {
  constructor(
    value: THREE.Texture,
    uvNode: Node | null = null,
    levelNode: Node | null = null,
    biasNode: Node | null = null
  ) {
    super(value, uvNode, levelNode, biasNode);
    Object.defineProperty(this, "updateType", {
      get: () => NodeUpdateType.OBJECT,
      set: () => undefined
    });
  }

  override setup(
    builder: NodeBuilder
  ) {
    this.value = this.#resolveTexture(builder.object);

    return super.setup(builder);
  }

  override update(
    frame: NodeFrame
  ): boolean | undefined {
    this.value = this.#resolveTexture(frame.object);

    return super.update(frame);
  }

  protected abstract pick(
    geometry: PulledChunkGeometry | null
  ): THREE.Texture;

  #resolveTexture(
    object: THREE.Object3D | null
  ): THREE.Texture {
    const geometry = object instanceof THREE.Mesh ? object.geometry : null;

    return this.pick(geometry instanceof PulledChunkGeometry ? geometry : null);
  }
}
