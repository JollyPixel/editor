// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type {
  Renderer,
  RendererEvents
} from "./Renderer.ts";
import type { BackendRenderComponent } from "../SceneBackend.ts";

export class HeadlessRenderer extends Emitter<RendererEvents<null>> implements Renderer<null> {
  readonly canvas: HTMLCanvasElement;

  #components: BackendRenderComponent[] = [];

  constructor(
    canvas: HTMLCanvasElement
  ) {
    super();
    this.canvas = canvas;
  }

  get renderComponents(): readonly BackendRenderComponent[] {
    return this.#components;
  }

  getSource(): null {
    return null;
  }

  setRatio(): this {
    return this;
  }

  addRenderComponent(
    component: BackendRenderComponent
  ): void {
    if (!this.#components.includes(component)) {
      this.#components.push(component);
    }
  }

  removeRenderComponent(
    component: BackendRenderComponent
  ): void {
    this.#components = this.#components.filter(
      (registered) => registered !== component
    );
  }

  observeResize(): void {
    return undefined;
  }

  unobserveResize(): void {
    return undefined;
  }

  resize(): void {
    return undefined;
  }

  draw(): void {
    this.emit("draw", { source: null });
  }

  compiled(): Promise<void> {
    return Promise.resolve();
  }

  clear(): void {
    return undefined;
  }

  dispose(): void {
    this.#components = [];
  }
}
