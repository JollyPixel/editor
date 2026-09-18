// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import type { EventMap } from "@openally/emitt";

export interface RenderViewport {
  /** Normalized [0, 1]. x=0 is left */
  x: number;
  /** Normalized [0, 1]. y=0 is bottom (WebGL convention) */
  y: number;
  /** Normalized width [0, 1] */
  width: number;
  /** Normalized height [0, 1] */
  height: number;
}

export interface RenderComponent {
  readonly threeCamera: THREE.Camera;
  readonly depth: number;
  readonly viewport: Readonly<RenderViewport> | null;

  prepareRender(
    canvasWidth: number,
    canvasHeight: number
  ): void;
}

export type RendererEvents<T = THREE.WebGPURenderer> = {
  resize: (
    size: { width: number; height: number; }
  ) => void;
  draw: (
    params: { source: T; }
  ) => void;
};

export interface Renderer<
  T = any,
  Events extends EventMap = RendererEvents<T>
> {
  readonly canvas: HTMLCanvasElement;
  readonly renderComponents: readonly RenderComponent[];

  getSource(): T;
  setRatio(
    ratio: number | null
  ): this;

  addRenderComponent(
    component: RenderComponent
  ): void;
  removeRenderComponent(
    component: RenderComponent
  ): void;
  markRenderOrderDirty(): void;

  on<Key extends keyof Events>(
    type: Key,
    handler: Events[Key]
  ): this;
  off<Key extends keyof Events>(
    type: Key,
    handler: Events[Key]
  ): void;
  emit<Key extends keyof Events>(
    type: Key,
    ...payload: Parameters<Events[Key]>
  ): void;

  observeResize(): void;
  unobserveResize(): void;
  resize(): void;
  draw(
    scene: THREE.Scene
  ): void;
  clear(): void;
  dispose(): void;
}
