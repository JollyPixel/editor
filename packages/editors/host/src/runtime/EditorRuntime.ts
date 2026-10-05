// Import Third-party Dependencies
import type { Systems } from "@jolly-pixel/engine";
import {
  Runtime,
  type RuntimeCanvasTarget,
  type RuntimeOptions
} from "@jolly-pixel/runtime";
import { inputLayers } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { suspendOnHover } from "./suspendOnHover.ts";
import {
  HOST_PARAMS,
  type HostParams
} from "../params/HostParams.ts";

export interface EditorRuntimeCreateOptions extends RuntimeOptions {
  params?: HostParams;
  /**
   * Whether the page runs inside a frame such as a studio tab.
   * @default window.parent !== window
   */
  framed?: boolean;
}

export interface EditorRuntimeLoadOptions {
  maxFps?: number;
}

export class EditorRuntime {
  static async create(
    canvas: RuntimeCanvasTarget,
    options: EditorRuntimeCreateOptions = {}
  ): Promise<EditorRuntime> {
    const {
      params = HOST_PARAMS.read(),
      renderOnDemand = true,
      framed = window.parent !== window,
      ...runtimeOptions
    } = options;
    const render = params.render ?? (framed ? "on-demand" : "continuous");
    const runtime = await Runtime.create(
      canvas,
      {
        suspendWhenHidden: true,
        ...runtimeOptions,
        renderOnDemand: renderOnDemand && render === "on-demand"
      }
    );
    runtime.world.input.keyboard.addGuard(
      inputLayers
    );

    return new EditorRuntime(runtime, params);
  }

  readonly runtime: Runtime;
  readonly params: HostParams;

  get samples(): number | undefined {
    return this.params.samples;
  }

  constructor(
    runtime: Runtime,
    params: HostParams = HOST_PARAMS.read()
  ) {
    this.runtime = runtime;
    this.params = params;
  }

  async load(
    scene: Systems.Scene,
    options: EditorRuntimeLoadOptions = {}
  ): Promise<void> {
    await this.runtime.load({
      scene,
      skipLoadingScreen: true,
      maxFps: this.params.maxFps ?? options.maxFps
    });
  }

  dispose(): void {
    this.runtime.dispose();
  }

  suspendKeyboardOnHover(
    target: EventTarget,
    event: string
  ): () => void {
    return suspendOnHover(
      this.runtime.world.input.keyboard,
      target,
      event
    );
  }
}
