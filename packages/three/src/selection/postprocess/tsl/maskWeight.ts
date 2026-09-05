// Import Third-party Dependencies
import { select, greaterThan, float, saturate } from "three/tsl";

export function maskWeight(c) {
  return saturate(c.rgb.length());
}

export function maskGate(c) {
  return select(greaterThan(maskWeight(c), float(0)), float(1), float(0));
}
