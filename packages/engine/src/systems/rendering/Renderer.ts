// Import Third-party Dependencies
import * as THREE from "three";
import type { Pass } from "three/addons/postprocessing/EffectComposer.js";
import type {
  GenericEventMap,
  _Handler as Handler,
  _RemoveEventListener as RemoveEventListener
} from "@posva/event-emitter";

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

  /** Render sort order — lower value rendered first (background), higher on top.
   * @default 0
   */
  readonly depth: number;

  /**
   * Normalized viewport rect (values in [0, 1], y=0 is bottom per WebGL convention).
   * null means full canvas.
   */
  readonly viewport: Readonly<RenderViewport> | null;

  /**
   * Called by the render strategy before each draw.
   * Implementations should sync their THREE.Camera transform from the actor
   * and update the projection matrix when canvas size changes.
   */
  prepareRender(
    canvasWidth: number,
    canvasHeight: number
  ): void;
}

export type RendererEvents = {
  resize: [
    { width: number; height: number; }
  ];
  draw: [
    { source: THREE.WebGLRenderer; }
  ];
};

export interface Renderer<
  T = any,
  Events extends GenericEventMap = RendererEvents
> {
  readonly canvas: HTMLCanvasElement;

  getSource(): T;
  setRenderMode(mode: RenderMode): this;
  setRatio(ratio: number | null): this;
  setEffects(...effects: Pass[]): this;

  addRenderComponent(component: RenderComponent): void;
  removeRenderComponent(component: RenderComponent): void;

  on<Key extends keyof Events>(
    type: Key,
    handler: Handler<Events[Key]>
  ): RemoveEventListener;
  off<Key extends keyof Events>(
    type: Key,
    handler?: Handler<Events[Key]>
  ): void;
  emit<Key extends keyof Events>(
    type: Key,
    ...payload: Events[Key] extends [unknown, ...unknown[]] | []
      ? Events[Key]
      : [Events[Key]]
  ): void;

  observeResize(): void;
  unobserveResize(): void;
  resize(): void;
  draw(): void;
  onDraw(callback: (source: T) => void): void;
  clear(): void;
}
