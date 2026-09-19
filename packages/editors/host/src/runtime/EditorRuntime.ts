// Import Third-party Dependencies
import type { Systems } from "@jolly-pixel/engine";
import {
  Runtime,
  type RuntimeCanvasTarget,
  type RuntimeOptions
} from "@jolly-pixel/runtime";
import { inputLayers } from "@jolly-pixel/ui";

export interface EditorRuntimeLoadOptions {
  maxFps?: number;
}

export interface HoverChangeDetail {
  hovering: boolean;
}

export class EditorRuntime {
  static async create(
    canvas: RuntimeCanvasTarget,
    options?: RuntimeOptions
  ): Promise<EditorRuntime> {
    const runtime = await Runtime.create(canvas, options);
    runtime.world.input.keyboard.addGuard(inputLayers);

    return new EditorRuntime(runtime);
  }

  readonly runtime: Runtime;

  constructor(
    runtime: Runtime
  ) {
    this.runtime = runtime;
  }

  async load(
    scene: Systems.Scene,
    options: EditorRuntimeLoadOptions = {}
  ): Promise<void> {
    await this.runtime.load({
      scene,
      skipLoadingScreen: true,
      maxFps: options.maxFps
    });
  }

  suspendKeyboardOnHover(
    target: EventTarget,
    event: string
  ): () => void {
    const { keyboard } = this.runtime.world.input;
    function listener(
      hoverEvent: Event
    ): void {
      const { detail } = hoverEvent as CustomEvent<HoverChangeDetail>;
      keyboard.enabled = !detail.hovering;
    }
    target.addEventListener(event, listener);

    return () => target.removeEventListener(event, listener);
  }
}
