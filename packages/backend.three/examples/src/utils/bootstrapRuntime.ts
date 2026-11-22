// Import Third-party Dependencies
import {
  Runtime,
  type RuntimeOptions,
  type RuntimeLoadOptions
} from "@jolly-pixel/backend.three";
import type { Systems } from "@jolly-pixel/ecs";

export interface BootstrapRuntimeOptions<
  TContext = Systems.WorldDefaultContext
> extends RuntimeOptions<TContext> {
  scene?: Systems.Scene<TContext>;
  loadingDelay?: RuntimeLoadOptions<TContext>["loadingDelay"];
}

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
