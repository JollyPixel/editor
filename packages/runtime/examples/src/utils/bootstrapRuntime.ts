// Import Third-party Dependencies
import {
  Runtime,
  loadRuntime,
  type RuntimeOptions,
  type LoadRuntimeOptions
} from "@jolly-pixel/runtime";
import type { Systems } from "@jolly-pixel/engine";

export interface BootstrapRuntimeOptions<
  TContext = Systems.WorldDefaultContext
> extends RuntimeOptions<TContext> {
  scene?: Systems.Scene<TContext>;
  loadingDelay?: LoadRuntimeOptions<TContext>["loadingDelay"];
}

/**
 * Locates the example page's canvas, boots a Runtime against it, then hands
 * off to loadRuntime() with the given scene. Every example script shares this
 * so it only has to declare its own Scene.
 */
export async function bootstrapRuntime<
  TContext = Systems.WorldDefaultContext
>(
  options: BootstrapRuntimeOptions<TContext> = {}
): Promise<Runtime<TContext>> {
  const { scene, loadingDelay, ...runtimeOptions } = options;

  const runtime = await Runtime.create("canvas", runtimeOptions);
  await loadRuntime(runtime, { scene, loadingDelay })
    .catch(console.error);

  return runtime;
}
