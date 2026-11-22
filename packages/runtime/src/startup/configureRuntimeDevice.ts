// Import Third-party Dependencies
import type { GameLoop } from "@jolly-pixel/loop";

// Import Internal Dependencies
import type { RuntimeBackend } from "../contract/RuntimeBackend.ts";
import type { RuntimeLogger } from "../contract/RuntimeLogger.ts";

export interface ConfigureRuntimeDeviceOptions {
  /**
   * Render cap in frames per second.
   * Overrides the GPU-benchmarked estimate and skips the benchmark.
   */
  maxFps?: number;
}

export type DeviceNavigator = Pick<
  Navigator,
  "userAgent" | "platform" | "maxTouchPoints"
>;

export async function configureRuntimeDevice(
  loop: Pick<GameLoop, "scheduler">,
  backend: Pick<RuntimeBackend, "adaptPixelRatio">,
  logger: Pick<RuntimeLogger, "warn">,
  options: ConfigureRuntimeDeviceOptions = {}
): Promise<void> {
  loop.scheduler.maxFps = options.maxFps ?? await benchmarkFps(logger);
  backend.adaptPixelRatio(
    cappedPixelRatio(isMobileDevice())
  );
}

export function isMobileDevice(
  device: DeviceNavigator = navigator
): boolean {
  const { userAgent, platform, maxTouchPoints } = device;

  return /android|iphone|ipod|ipad/i.test(userAgent) ||
    platform === "iPad" ||
    (platform === "MacIntel" && maxTouchPoints > 0);
}

async function benchmarkFps(
  logger: Pick<RuntimeLogger, "warn">
): Promise<number> {
  const { getGPUTier } = await import("@pmndrs/detect-gpu");
  const { fps = Infinity, tier } = await getGPUTier();

  if (tier < 1) {
    logger.warn(
      "GPU tier could not be determined; falling back to default settings."
    );
  }

  return fps;
}

function cappedPixelRatio(
  isMobile: boolean
): number {
  const maxPixelRatio = isMobile ? 1.5 : 2;

  return Math.min(
    maxPixelRatio,
    window.devicePixelRatio
  );
}
