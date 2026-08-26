// Import Third-party Dependencies
import { getGPUTier } from "@pmndrs/detect-gpu";

// Import Internal Dependencies
import type { Runtime } from "../Runtime.ts";

export interface ConfigureRuntimeDeviceOptions {
  /**
   * Render cap in frames per second.
   * Overrides the GPU-benchmarked estimate.
   */
  maxFps?: number;
}

export async function configureRuntimeDevice<TContext>(
  runtime: Runtime<TContext>,
  options: ConfigureRuntimeDeviceOptions = {}
): Promise<void> {
  const {
    fps,
    isMobile = false,
    tier
  } = await getGPUTier();

  if (tier < 1) {
    // tier 0 also covers "couldn't be determined" (e.g. no WebGL context
    // available to probe, as in headless/sandboxed browsers): fall back to
    // safe defaults instead of refusing to boot.
    console.warn(
      "GPU tier could not be determined; falling back to default settings."
    );
  }

  runtime.loop.scheduler.maxFps = options.maxFps ?? fps ?? Infinity;
  runtime.world.renderer.getSource().setPixelRatio(
    getDevicePixelRatio(isMobile)
  );
}

function getDevicePixelRatio(
  isMobile: boolean
): number {
  const maxPixelRatio = isMobile ? 1.5 : 1;

  return Math.min(
    maxPixelRatio,
    window.devicePixelRatio
  );
}
