export type DeviceNavigator = Pick<
  Navigator,
  "userAgent" | "platform" | "maxTouchPoints"
>;

export function runtimePixelRatio(): number {
  const maxPixelRatio = isMobileDevice() ? 1.5 : 2;

  return Math.min(
    maxPixelRatio,
    window.devicePixelRatio
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
