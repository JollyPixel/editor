// Import Third-party Dependencies
import { AssetCatalog } from "@jolly-pixel/asset";
import { Systems } from "@jolly-pixel/ecs";

// Import Internal Dependencies
import {
  Runtime,
  type RuntimeOptions
} from "../../../src/runtime/Runtime.ts";
import { ThreeRuntimeBackend } from "../../../src/runtime/ThreeRuntimeBackend.ts";
import type { FakeRenderer } from "./FakeRenderer.ts";

export function constructRuntime(
  canvas: HTMLCanvasElement,
  renderer: FakeRenderer,
  options: RuntimeOptions = {}
): Runtime {
  const logger = options.logger ?? new Systems.Logger();
  const backend = Reflect.construct(ThreeRuntimeBackend, [
    renderer,
    new AssetCatalog([]),
    logger,
    {
      audio: {},
      ...options
    }
  ]);

  return Reflect.construct(Runtime, [
    canvas,
    backend,
    {
      ...options,
      logger
    }
  ]);
}
