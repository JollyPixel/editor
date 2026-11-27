// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { CatalogApplied } from "./protocol.ts";

export interface CatalogActivityEntry {
  readonly applied: CatalogApplied;
  readonly actor: EventStore.Actor;
}

export type CatalogActivityEventMap = {
  applied: (
    entry: CatalogActivityEntry
  ) => void;
};

export class CatalogActivity extends Emitter<CatalogActivityEventMap> {}
