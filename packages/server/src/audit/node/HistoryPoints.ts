// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import { TagName } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import type {
  AuditLog,
  KeptVersion
} from "./AuditLog.ts";

// CONSTANTS
const kHistoryActor: EventStore.Actor = {
  type: "system",
  source: "audit"
};

export class HistoryPoints {
  static tagName(
    version: number
  ): string {
    return TagName.historyPoint(version).value;
  }

  #tags: EventStore.EventStore["tags"];
  #audit: Pick<AuditLog, "references">;

  constructor(
    tags: EventStore.EventStore["tags"],
    audit: Pick<AuditLog, "references">
  ) {
    this.#tags = tags;
    this.#audit = audit;
  }

  async keep(
    kept: KeptVersion
  ): Promise<void> {
    const name = HistoryPoints.tagName(kept.version);
    if (await this.#tags.get(kept.assetId, name) !== undefined) {
      return;
    }

    await this.#tags.create({
      assetId: kept.assetId,
      name,
      eventVersion: kept.version,
      actor: kHistoryActor
    });
  }

  async release(
    kept: KeptVersion
  ): Promise<void> {
    if (!this.#audit.references(kept)) {
      await this.#tags.delete(kept.assetId, HistoryPoints.tagName(kept.version));
    }
  }
}
