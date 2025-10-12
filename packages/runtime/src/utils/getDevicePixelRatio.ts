// CONSTANTS
const kDesktopMaxPixelRatio = 1;
const kMobileMaxPixelRatio = 1.5;

export function getDevicePixelRatio(
  isMobile: boolean
): number {
  return isMobile ?
    Math.min(kMobileMaxPixelRatio, window.devicePixelRatio) :
    Math.min(kDesktopMaxPixelRatio, window.devicePixelRatio);
}
