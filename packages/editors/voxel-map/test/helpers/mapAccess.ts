// Import Internal Dependencies
import {
  MAP_CAPABILITY_TABLE,
  type MapAccess
} from "../../src/access/MapAccess.ts";

export function mapAccess(
  current: MapAccess = MAP_CAPABILITY_TABLE.full
): { current: MapAccess; } {
  return { current };
}
