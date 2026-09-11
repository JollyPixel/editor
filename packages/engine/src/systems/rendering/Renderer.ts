// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import type { EventMap } from "@openally/emitt";

// Import Internal Dependencies
import type { RenderMode } from "./RenderStrategy.ts";

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

export type RendererEvents = {
  resize: (
    size: { width: number; height: number; }
  ) => void;
  draw: (
    params: { source: THREE.WebGPURenderer; }
  ) => void;
};

export interface Renderer<
  T = any,
  Events extends EventMap = RendererEvents
> {
  readonly canvas: HTMLCanvasElement;

  getSource(): T;
  setRenderMode(
    mode: RenderMode
  ): this;
  setRatio(
    ratio: number | null
  ): this;

  addRenderComponent(
    component: RenderComponent
  ): void;
  removeRenderComponent(
    component: RenderComponent
  ): void;
  updateRenderComponent(
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
  draw(): void;
  onDraw(
    callback: (event: { source: T; }) => void
  ): void;
  clear(): void;
  dispose(): void;
}
