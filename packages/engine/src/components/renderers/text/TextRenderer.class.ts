// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import * as Systems from "../../../systems/index.ts";
import { Actor, ActorComponent } from "../../../actor/index.ts";
import {
  Text3D,
  type Text3DOptions
} from "./Text3D.class.ts";
import { font, type Font } from "./loader.ts";

export interface TextRendererOptions extends Omit<Text3DOptions, "font"> {
  path: string;
  text?: string;
}

export class TextRenderer extends ActorComponent<any> {
  #asset: Systems.LazyAsset<Font>;

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
      path,
      text,
      textGeometryOptions,
      material = new THREE.MeshBasicMaterial()
    } = options;

    this.#asset = font(path);
    this.text = new Text3D({
      material,
      textGeometryOptions
    });
    if (text) {
      this.text.setValue(text);
    }
  }

  awake(): void {
    const font = this.#asset.get();

    this.text.setFont(font);
    this.updateMesh();
  }

  override destroy(): void {
    this.text.dispose();
  }

  updateMesh(): void {
    for (const child of this.actor.threeObject.children) {
      isMeshWithGeometry(child) && this.actor.threeObject.remove(child);
    }

    const mesh = this.text.mesh;
    if (mesh) {
      this.actor.threeObject.add(mesh);
    }
  }
}

function isMeshWithGeometry(
  object: THREE.Object3D
): object is THREE.Mesh {
  return object instanceof THREE.Mesh && object.geometry instanceof THREE.BufferGeometry;
}
