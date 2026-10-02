// Import Internal Dependencies
import type { Runtime } from "../Runtime.ts";

export interface ConfigureRuntimeDeviceOptions {
  /**
   * Render cap in frames per second.
   * Overrides the GPU-benchmarked estimate and skips the benchmark.
   */
  maxFps?: number;
  /**
   * Lowers the pixel ratio to fit the detected device.
   * @default true
   */
  adaptivePixelRatio?: boolean;
}

export type DeviceNavigator = Pick<
  Navigator,
  "userAgent" | "platform" | "maxTouchPoints"
>;

interface DeviceProfile {
  fps?: number;
  isMobile: boolean;
}

export async function configureRuntimeDevice<TContext>(
  runtime: Runtime<TContext>,
  options: ConfigureRuntimeDeviceOptions = {}
): Promise<void> {
  const profile: DeviceProfile = options.maxFps === undefined ?
    await benchmarkDevice() :
    { isMobile: isMobileDevice() };
  const { fps, isMobile } = profile;

  runtime.loop.scheduler.maxFps = options.maxFps ?? fps ?? Infinity;
  if (options.adaptivePixelRatio ?? true) {
    runtime.world.renderer.getSource().setPixelRatio(
      getDevicePixelRatio(isMobile)
    );
  }
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
    /*
     * tier 0 also covers "couldn't be determined" (e.g. no WebGL context
     * available to probe, as in headless/sandboxed browsers): fall back to
     * safe defaults instead of refusing to boot.
     */
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
