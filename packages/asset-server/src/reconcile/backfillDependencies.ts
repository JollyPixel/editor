// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import type { CatalogProjection } from "../catalog/CatalogProjection.ts";
import type { AssetKindRegistry } from "../kinds/AssetKindRegistry.ts";
import type { AssetProjector } from "../projection/AssetProjector.ts";
import type { AssetWriter } from "../writer/AssetWriter.ts";
import { decodeContent } from "../events/inlineContent.ts";
import {
  silentLogger,
  type Logger
} from "../logger.ts";

// CONSTANTS
const kBackfillActor: EventStore.Actor = {
  type: "system",
  source: "dependency-backfill"
};

export interface BackfillDependenciesOptions {
  catalog: CatalogProjection;
  kinds: AssetKindRegistry;
  projector: AssetProjector;
  writer: AssetWriter;
  logger?: Logger;
}

export async function backfillDependencies(
  options: BackfillDependenciesOptions
): Promise<number> {
  const {
    catalog,
    kinds,
    projector,
    writer,
    logger = silentLogger()
  } = options;

  const unindexed = Array.from(
    catalog.unindexed(),
    (record) => record.id.value
  );

  let rewritten = 0;
  for (const assetId of unindexed) {
    const desired = projector.desired(assetId);
    if (
      desired === null ||
      !kinds.has(desired.kind) ||
      kinds.get(desired.kind).dependencies === undefined
    ) {
      continue;
    }

    const result = await writer.update({
      assetId,
      data: decodeContent(desired.content),
      actor: kBackfillActor,
      alreadyProjected: projector.projected(assetId)?.hash === desired.hash
    });
    if (result.ok) {
      rewritten++;
    }
    else {
      logger
        .withMetadata({
          assetId,
          reason: result.val.message
        })
        .error("asset dependency backfill failed");
    }
  }

  return rewritten;
}
