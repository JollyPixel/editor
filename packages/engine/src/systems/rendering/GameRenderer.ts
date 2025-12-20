// Import Third-party Dependencies
import * as THREE from "three";
import type { Pass } from "three/addons/postprocessing/EffectComposer.js";

// Import Internal Dependencies
import type { RenderMode } from "./RenderStrategy.ts";

export type RenderComponent = THREE.PerspectiveCamera | THREE.OrthographicCamera;

export interface GameRenderer<T = any> {
  readonly canvas: HTMLCanvasElement;

  getSource(): T;
  setRenderMode(mode: RenderMode): this;
  setRatio(ratio: number | null): this;
  setEffects(...effects: Pass[]): this;

  addRenderComponent(component: RenderComponent): void;
  removeRenderComponent(component: RenderComponent): void;

  resize(): void;
  draw(): void;
  onDraw(callback: (source: T) => void): void;
  clear(): void;
}
