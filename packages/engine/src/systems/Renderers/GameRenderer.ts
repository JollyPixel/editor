// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import type { Scene } from "../Scene.js";

export type RenderComponent = THREE.PerspectiveCamera | THREE.OrthographicCamera;

export interface GameRenderer<T = any> {
  readonly canvas: HTMLCanvasElement;

  getSource(): T;
  setRatio(ratio: number | null): this;

  addRenderComponent(component: RenderComponent): void;
  removeRenderComponent(component: RenderComponent): void;

  resize(): void;
  draw(scene: Scene): void;
  onDraw(callback: (source: T) => void): void;
  clear(): void;
}
