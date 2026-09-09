// Import Third-party Dependencies
import {
  Runtime,
  type RuntimeOptions,
  type RuntimeLoadOptions
} from "@jolly-pixel/runtime";
import type { Systems } from "@jolly-pixel/engine";

export interface BootstrapRuntimeOptions<
  TContext = Systems.WorldDefaultContext
> extends RuntimeOptions<TContext> {
  scene?: Systems.Scene<TContext>;
  loadingDelay?: RuntimeLoadOptions<TContext>["loadingDelay"];
}

/**
 * Locates the example page's canvas and loads a Runtime with the given scene.
 * Every example script shares this so it only has to declare its own Scene.
 */
export async function bootstrapRuntime<
  TContext = Systems.WorldDefaultContext
>(
  options: BootstrapRuntimeOptions<TContext> = {}
): Promise<Runtime<TContext>> {
  const { scene, loadingDelay, ...runtimeOptions } = options;

  const runtime = await Runtime.create("canvas", runtimeOptions);
  await runtime.load({ scene, loadingDelay })
    .catch(console.error);

  return runtime;
}
