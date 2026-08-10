// CONSTANTS
const kGoldenAngle = 137.5;

/**
 * Fixed across hues so every peer stays equally legible. Over the first sixteen hues these values
 * measure 3.45:1 against the light surface and 4.12:1 against the dark one; at 70% lightness the
 * light surface drops to 2.36:1, under the 3:1 a lock ring needs.
 */
const kPeerLightness = 60;
const kPeerChroma = 0.16;

/** Golden angle rotation, so consecutive indices land far apart. */
export function peerColor(
  index: number
): string {
  const hue = (((index * kGoldenAngle) % 360) + 360) % 360;

  return `oklch(${kPeerLightness}% ${kPeerChroma} ${hue})`;
}
