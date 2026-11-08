// Import Third-party Dependencies
import type { EventMap } from "@openally/emitt";

// Import Internal Dependencies
import type { CanvasDimensions } from "./CanvasDimensions.ts";
import type { Viewport } from "./Viewport.ts";
import type {
  BackendRenderComponent,
  BackendSceneGraph
} from "../SceneBackend.ts";

export interface RenderComponent {
  readonly depth: number;
  readonly viewport: Viewport | null;

  prepareRender(
    canvas: CanvasDimensions
  ): void;
}

export type RendererEvents<T = unknown> = {
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
  readonly renderComponents: readonly BackendRenderComponent[];

  getSource(): T;
  setRatio(
    ratio: number | null
  ): this;

  addRenderComponent(
    component: BackendRenderComponent
  ): void;
  removeRenderComponent(
    component: BackendRenderComponent
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
    graph: BackendSceneGraph
  ): void;
  compiled(): Promise<void>;
  clear(): void;
  dispose(): void;
}
