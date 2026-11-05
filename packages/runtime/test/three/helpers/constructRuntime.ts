// Import Third-party Dependencies
import { AssetCatalog } from "@jolly-pixel/asset";
import { Systems } from "@jolly-pixel/engine";

// Import Internal Dependencies
import {
  Runtime,
  type RuntimeOptions
} from "../../../src/three/Runtime.ts";
import { ThreeRuntimeBackend } from "../../../src/three/ThreeRuntimeBackend.ts";
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
