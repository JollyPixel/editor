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

export type RenderComponent = THREE.PerspectiveCamera | THREE.OrthographicCamera;

export type RendererEvents = {
  resize: [
    { width: number; height: number; }
  ];
  draw: [
    { source: THREE.WebGLRenderer; }
  ];
};

export interface Renderer<T = any, Events extends GenericEventMap = RendererEvents> {
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

  resize(): void;
  draw(): void;
  onDraw(callback: (source: T) => void): void;
  clear(): void;
}
