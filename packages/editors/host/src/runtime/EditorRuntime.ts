// Import Third-party Dependencies
import type { Systems } from "@jolly-pixel/engine";
import {
  Runtime,
  type RuntimeCanvasTarget,
  type RuntimeOptions
} from "@jolly-pixel/runtime";
import {
  inputLayers,
  LocalStorageAdapter,
  type StorageAdapter
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import { suspendOnHover } from "./suspendOnHover.ts";
import { RuntimeWidgets } from "./RuntimeWidgets.ts";
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
  /**
   * Where the visibility of the runtime widgets is kept.
   * @default new LocalStorageAdapter()
   */
  storage?: StorageAdapter;
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
      storage,
      renderer = {},
      ...runtimeOptions
    } = options;
    const render = params.render ?? (framed ? "on-demand" : "continuous");
    const runtime = await Runtime.create(
      canvas,
      {
        suspendWhenHidden: true,
        ...runtimeOptions,
        renderer: params.gpuTime ? trackTimestamps(renderer) : renderer,
        renderOnDemand: renderOnDemand && render === "on-demand"
      }
    );
    runtime.world.input.keyboard.addGuard(
      inputLayers
    );

    const editorRuntime = new EditorRuntime(runtime, params, storage);
    editorRuntime.widgets.restore();

    return editorRuntime;
  }

  readonly runtime: Runtime;
  readonly params: HostParams;
  readonly widgets: RuntimeWidgets;

  get samples(): number | undefined {
    return this.params.samples;
  }

  constructor(
    runtime: Runtime,
    params: HostParams = HOST_PARAMS.read(),
    storage: StorageAdapter = new LocalStorageAdapter()
  ) {
    this.runtime = runtime;
    this.params = params;
    this.widgets = new RuntimeWidgets(runtime, storage);
  }

  async load(
    scene: Systems.Scene,
    options: EditorRuntimeLoadOptions = {}
  ): Promise<void> {
    if (this.runtime.running) {
      await this.runtime.world.sceneManager.loadScene(scene).done;
      await this.runtime.nextFrame();

      return;
    }

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

function trackTimestamps(
  options: Systems.ThreeRendererOptions
): Systems.ThreeRendererOptions {
  return {
    ...options,
    webgpu: {
      ...options.webgpu,
      trackTimestamp: true
    }
  };
}
