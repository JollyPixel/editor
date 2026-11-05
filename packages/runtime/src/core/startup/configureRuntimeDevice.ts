// Import Third-party Dependencies
import type { GameLoop } from "@jolly-pixel/loop";

// Import Internal Dependencies
import type { RuntimeBackend } from "../contract/RuntimeBackend.ts";

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

interface DeviceProfile {
  fps?: number;
  isMobile: boolean;
}

export async function configureRuntimeDevice(
  loop: Pick<GameLoop, "scheduler">,
  backend: Pick<RuntimeBackend, "adaptPixelRatio">,
  options: ConfigureRuntimeDeviceOptions = {}
): Promise<void> {
  const profile: DeviceProfile = options.maxFps === undefined ?
    await benchmarkDevice() :
    { isMobile: isMobileDevice() };
  const { fps, isMobile } = profile;

  loop.scheduler.maxFps = options.maxFps ?? fps ?? Infinity;
  backend.adaptPixelRatio(
    getDevicePixelRatio(isMobile)
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

async function benchmarkDevice(): Promise<DeviceProfile> {
  const { getGPUTier } = await import("@pmndrs/detect-gpu");
  const {
    fps,
    isMobile = false,
    tier
  } = await getGPUTier();

  if (tier < 1) {
    console.warn(
      "GPU tier could not be determined; falling back to default settings."
    );
  }

  return {
    fps,
    isMobile
  };
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
