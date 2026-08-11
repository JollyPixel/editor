// CONSTANTS
const kGoldenAngle = 137.5;

/**
 * Fixed lightness keeps peer colors legible across hues.
 */
const kPeerLightness = 60;
const kPeerChroma = 0.16;

/**
 * Rotates hues by the golden angle.
 */
export function peerColor(
  index: number
): string {
  const hue = (((index * kGoldenAngle) % 360) + 360) % 360;

  return `oklch(${kPeerLightness}% ${kPeerChroma} ${hue})`;
}
