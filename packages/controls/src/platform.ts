const kApplePlatform = /^Mac|iPhone|iPod|iPad/i;

let applePlatform: boolean | null = null;

export function detectApplePlatform(
  platform: string | undefined
): boolean {
  return platform !== undefined && kApplePlatform.test(platform);
}

export function isApplePlatform(): boolean {
  if (applePlatform === null) {
    applePlatform = detectApplePlatform(
      typeof navigator === "undefined" ? undefined : navigator.platform
    );
  }

  return applePlatform;
}
