// Import Third-party Dependencies
import * as THREE from "three";
import {
  NodeUpdateType,
  Texture3DNode,
  type Node,
  type NodeBuilder,
  type NodeFrame
} from "three/webgpu";
import { float } from "three/tsl";

// Import Internal Dependencies
import { PulledChunkGeometry } from "./PulledChunkGeometry.ts";

// CONSTANTS
const kPlaceholder = darkPlaceholder();

export class ChunkLightNode extends Texture3DNode {
  constructor(
    value: THREE.Texture = kPlaceholder,
    uvNode: Node | null = null,
    levelNode: Node | null = null
  ) {
    super(value, uvNode, levelNode);
    Object.defineProperty(this, "updateType", {
      get: () => NodeUpdateType.OBJECT,
      set: () => undefined
    });
  }

  override setup(
    builder: NodeBuilder
  ) {
    this.value = resolveLightTexture(builder.object);

    return super.setup(builder);
  }

  override update(
    frame: NodeFrame
  ): boolean | undefined {
    this.value = resolveLightTexture(frame.object);

    return super.update(frame);
  }
}

export function chunkLight(
  uvw: Node<"vec3">
): ChunkLightNode {
  return new ChunkLightNode(kPlaceholder, uvw, float(0));
}

function darkPlaceholder(): THREE.Data3DTexture {
  const texture = new THREE.Data3DTexture(new Uint8Array(4), 1, 1, 1);
  texture.needsUpdate = true;

  return texture;
}

function resolveLightTexture(
  object: THREE.Object3D | null
): THREE.Texture {
  const geometry = object instanceof THREE.Mesh ? object.geometry : null;

  return geometry instanceof PulledChunkGeometry && geometry.light !== null ?
    geometry.light :
    kPlaceholder;
}
