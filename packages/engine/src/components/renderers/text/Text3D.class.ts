// Import Third-party Dependencies
import * as THREE from "three";
import {
  TextGeometry,
  type TextGeometryParameters
} from "three/addons/geometries/TextGeometry.js";
import {
  type Font
} from "three/examples/jsm/loaders/FontLoader.js";

// CONSTANTS
const kDefaultGeometryOptions: Partial<TextGeometryParameters> = {
  size: 1,
  depth: 1
};

export type Text3DGeometryParameters = Omit<TextGeometryParameters, "font"> & {
  center?: boolean;
};

export interface Text3DOptions {
  font?: Font;
  textGeometryOptions?: Text3DGeometryParameters;
  material?: THREE.Material;
}

export class Text3D {
  #font: Font;
  #text: string = "";
  #geometryOptions: Text3DGeometryParameters;
  #mesh: THREE.Mesh | null = null;
  #geometry: TextGeometry | null = null;
  #needsUpdate: boolean = true;

  material: THREE.Material;

  constructor(
    options: Text3DOptions
  ) {
    const {
      font,
      textGeometryOptions = kDefaultGeometryOptions,
      material = new THREE.MeshBasicMaterial()
    } = options;

    if (font) {
      this.setFont(font);
    }
    this.#geometryOptions = { ...textGeometryOptions };
    this.material = material;
  }

  get mesh(): THREE.Mesh | null {
    if (this.#needsUpdate) {
      this.#updateMesh();
    }

    return this.#mesh;
  }

  getBoundingBox(): THREE.Box3 | null {
    return this.#geometry?.boundingBox?.clone() ?? null;
  }

  setValue(
    text: string
  ): this {
    const trimmedText = text.trim();
    if (this.#text !== trimmedText) {
      this.#text = trimmedText;
      this.#needsUpdate = true;
    }

    return this;
  }

  getValue(): string {
    return this.#text;
  }

  setGeometryOptions(
    options: Partial<Omit<TextGeometryParameters, "font">>
  ): this {
    this.#geometryOptions = { ...this.#geometryOptions, ...options };
    this.#needsUpdate = true;

    return this;
  }

  setMaterial(
    material: THREE.Material
  ): this {
    this.material = material;
    if (this.#mesh) {
      this.#mesh.material = material;
    }

    return this;
  }

  setWireframe(
    wireframe: boolean = true
  ): this {
    if (this.material instanceof THREE.MeshBasicMaterial) {
      this.material.wireframe = wireframe;
    }

    return this;
  }

  setFont(
    font: Font
  ): this {
    if (this.#font !== font) {
      this.#font = font;
      this.#needsUpdate = true;
    }

    return this;
  }

  dispose(): void {
    if (this.#geometry) {
      this.#geometry.dispose();
      this.#geometry = null;
    }

    if (this.#mesh) {
      this.#mesh.removeFromParent();
      this.#mesh = null;
    }

    this.#needsUpdate = true;
  }

  #updateMesh(): void {
    if (this.#geometry) {
      this.#geometry.dispose();
    }

    const { center = false, ...othersGeometryOptions } = this.#geometryOptions;

    this.#geometry = new TextGeometry(this.#text, {
      font: this.#font,
      ...othersGeometryOptions
    });
    this.#geometry.computeBoundingBox();
    if (center) {
      this.#geometry.center();
    }

    if (this.#mesh) {
      this.#mesh.geometry = this.#geometry;
    }
    else {
      this.#mesh = new THREE.Mesh(this.#geometry, this.material);
    }

    this.#needsUpdate = false;
  }
}
