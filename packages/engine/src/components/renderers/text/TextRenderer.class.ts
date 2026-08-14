// Import Third-party Dependencies
import type { AssetReference } from "@jolly-pixel/asset";
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { Actor, ActorComponent } from "../../../actor/index.ts";
import {
  Text3D,
  type Text3DOptions
} from "./Text3D.class.ts";
import { type Font } from "./loader.ts";

export interface TextRendererOptions extends Omit<Text3DOptions, "font"> {
  asset: AssetReference<Font>;
  text?: string;
}

/**
 * Builds Three.js text from a prepared font asset during awake.
 */
export class TextRenderer extends ActorComponent<any> {
  #asset: AssetReference<Font>;

  text: Text3D;

  constructor(
    actor: Actor<any>,
    options: TextRendererOptions
  ) {
    super({
      actor,
      typeName: "TextRenderer"
    });

    const {
      asset,
      text,
      textGeometryOptions,
      material = new THREE.MeshBasicMaterial()
    } = options;

    this.#asset = asset;
    this.text = new Text3D({
      material,
      textGeometryOptions
    });
    if (text) {
      this.text.setValue(text);
    }
  }

  awake(): void {
    const font = this.getAsset(this.#asset);

    this.text.setFont(font);
    this.updateMesh();
  }

  override destroy(): void {
    this.text.dispose();
  }

  updateMesh(): void {
    for (const child of this.actor.object3D.children) {
      isMeshWithGeometry(child) && this.actor.object3D.remove(child);
    }

    const mesh = this.text.mesh;
    if (mesh) {
      this.actor.object3D.add(mesh);
    }
  }
}

function isMeshWithGeometry(
  object: THREE.Object3D
): object is THREE.Mesh {
  return object instanceof THREE.Mesh && object.geometry instanceof THREE.BufferGeometry;
}
