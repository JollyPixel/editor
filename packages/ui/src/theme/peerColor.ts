// CONSTANTS
const kGoldenAngle = 137.5;

/**
 * Bright, moderately saturated colors keep peer markers clear on dark scenes.
 * Hex output is also accepted by Three's Color parser.
 */
const kPeerLightness = 0.7;
const kPeerSaturation = 0.72;

/**
 * Rotates hues by the golden angle and returns a cross-renderer CSS color.
 */
export function peerColor(
  index: number
): string {
  const hue = (((index * kGoldenAngle) % 360) + 360) % 360;

  return hslToHex(
    hue,
    kPeerSaturation,
    kPeerLightness
  );
}

function hslToHex(
  hue: number,
  saturation: number,
  lightness: number
): string {
  const chroma = (1 - Math.abs((2 * lightness) - 1)) * saturation;
  const huePrime = hue / 60;
  const secondary = chroma * (1 - Math.abs((huePrime % 2) - 1));
  let red = 0;
  let green = 0;
  let blue = 0;

  if (huePrime < 1) {
    red = chroma;
    green = secondary;
  }
  else if (huePrime < 2) {
    red = secondary;
    green = chroma;
  }
  else if (huePrime < 3) {
    green = chroma;
    blue = secondary;
  }
  else if (huePrime < 4) {
    green = secondary;
    blue = chroma;
  }
  else if (huePrime < 5) {
    red = secondary;
    blue = chroma;
  }
  else {
    red = chroma;
    blue = secondary;
  }
  const match = lightness - (chroma / 2);

  return `#${toHex(red + match)}${toHex(green + match)}${toHex(blue + match)}`;
}

function toHex(
  value: number
): string {
  return Math.round(value * 255).toString(16).padStart(2, "0");
}
