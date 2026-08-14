// Import Third-party Dependencies
import { getGPUTier } from "detect-gpu";

// Import Internal Dependencies
import type { Runtime } from "../Runtime.ts";

export async function configureRuntimeDevice<TContext>(
  runtime: Runtime<TContext>
): Promise<void> {
  const {
    fps,
    isMobile = false,
    tier
  } = await getGPUTier();

  if (tier < 1) {
    throw new Error("GPU is not powerful enough to run this game");
  }

  runtime.world.setFps(fps ?? 60);
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
