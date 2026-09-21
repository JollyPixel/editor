// Import Internal Dependencies
import { STATE_DIRECTORY } from "../constants.ts";

export function isStatePath(
  assetPath: string
): boolean {
  const lowered = assetPath.toLowerCase();

  return lowered === STATE_DIRECTORY ||
    lowered.startsWith(`${STATE_DIRECTORY}/`);
}
