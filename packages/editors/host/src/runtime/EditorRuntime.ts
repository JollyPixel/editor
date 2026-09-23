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
      params,
      ...runtimeOptions
    } = options;
    const runtime = await Runtime.create(
      canvas,
      runtimeOptions
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
