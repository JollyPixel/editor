// Import Internal Dependencies
import {
  MAP_CAPABILITIES,
  type MapAccess
} from "../../src/access/MapAccess.ts";

export function mapAccess(
  current: MapAccess = MAP_CAPABILITIES.full
): { current: MapAccess; } {
  return { current };
}
