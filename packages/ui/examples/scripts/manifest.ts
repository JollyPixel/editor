// Import Internal Dependencies
import type { GalleryExample } from "./types.ts";
import type { GalleryGroup } from "./groups.ts";

import { TOKENS_EXAMPLE } from "./examples/foundation/tokens.ts";
import { FOUNDATION_EXAMPLES } from "./examples/foundation/index.ts";
import { PEER_EXAMPLES } from "./examples/peer/index.ts";
import { CONTROLS_EXAMPLES } from "./examples/controls/index.ts";
import { CONTAINERS_EXAMPLES } from "./examples/containers/index.ts";
import { DATA_EXAMPLES } from "./examples/data/index.ts";
import { SCENARIOS_EXAMPLES } from "./examples/scenarios/index.ts";
import { MONITORS_EXAMPLES } from "./examples/monitors/index.ts";
import { FEEDBACK_EXAMPLES } from "./examples/feedback/index.ts";
import { MATH_EXAMPLES } from "./examples/math/index.ts";

// CONSTANTS
const kExamplesByGroup: Record<GalleryGroup, readonly GalleryExample[]> = {
  foundation: FOUNDATION_EXAMPLES,
  peer: PEER_EXAMPLES,
  controls: CONTROLS_EXAMPLES,
  containers: CONTAINERS_EXAMPLES,
  data: DATA_EXAMPLES,
  scenarios: SCENARIOS_EXAMPLES,
  monitors: MONITORS_EXAMPLES,
  feedback: FEEDBACK_EXAMPLES,
  math: MATH_EXAMPLES
};

/**
 * The navigation and E2E sweep derive from this list, in group declaration order.
 */
export const manifest: readonly GalleryExample[] = Object
  .values(kExamplesByGroup)
  .flat();

export function findExample(
  id: string | null
): GalleryExample {
  return manifest.find(
    (example) => example.id === id
  ) ?? TOKENS_EXAMPLE;
}
