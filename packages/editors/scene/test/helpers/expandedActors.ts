// Import Internal Dependencies
import type { ExpandedActors } from "../../src/state/SelectionStore.ts";

export const NO_EXPANDED_ACTORS: ExpandedActors = {
  expandedActor: () => null,
  componentEntry: () => null,
  subscribe: () => () => undefined
};
