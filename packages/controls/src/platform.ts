// CONSTANTS
const kApplePlatform = /^Mac|iPhone|iPod|iPad/i;

export function isApplePlatform(): boolean {
  return typeof navigator !== "undefined" &&
    kApplePlatform.test(navigator.platform);
}
