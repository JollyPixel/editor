// CONSTANTS
const kLinearCutoff = 0.04045;
const kEncodedCutoff = 0.0031308;
const kLinearSlope = 12.92;
const kGammaOffset = 0.055;
const kGamma = 2.4;

export function srgbToLinear(
  channel: number
): number {
  if (channel <= kLinearCutoff) {
    return channel / kLinearSlope;
  }

  return ((channel + kGammaOffset) / (1 + kGammaOffset)) ** kGamma;
}

export function linearToSrgb(
  channel: number
): number {
  if (channel <= kEncodedCutoff) {
    return channel * kLinearSlope;
  }

  return ((1 + kGammaOffset) * (channel ** (1 / kGamma))) - kGammaOffset;
}
