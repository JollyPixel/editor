// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import type { EventMap } from "@openally/emitt";

// Import Internal Dependencies
import type { PostProcessing } from "./compositing/PostProcessing.ts";
import type { CanvasDimensions } from "./CanvasDimensions.ts";
import type { Viewport } from "./Viewport.ts";

export interface RenderComponent {
  readonly threeCamera: THREE.Camera;
  readonly depth: number;
  readonly viewport: Viewport | null;
  /**
   * Replaces the direct render with a `THREE.RenderPipeline`.
   * @default null
   */
  readonly postProcessing?: PostProcessing | null;

  prepareRender(
    canvas: CanvasDimensions
  ): void;
}

export type RendererEvents<T = THREE.WebGPURenderer> = {
  resize: (
    size: CanvasDimensions
  ) => void;
  draw: (
    params: { source: T; }
  ) => void;
  compiled: () => void;
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
  compiled(): Promise<void>;
  clear(): void;
  dispose(): void;
}
