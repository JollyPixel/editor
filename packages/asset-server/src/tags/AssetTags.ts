// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";
import { Emitter } from "@openally/emitt";
import {
  Err,
  Ok,
  type Result
} from "@openally/result";

// Import Internal Dependencies
import {
  ASSET_CHECKPOINT_EVENT_TYPES,
  ASSET_CREATED,
  ASSET_UPDATED,
  parseAssetEvent,
  type AssetEvent,
  type AssetEventDataMap
} from "../events/AssetEvents.ts";
import { decodeContent } from "../events/inlineContent.ts";
import type { AssetProjector } from "../projection/AssetProjector.ts";
import type { AssetWriter } from "../writer/AssetWriter.ts";
import type { ContentObjects } from "../objects/ContentObjects.ts";
import { asError } from "../utils/asError.ts";
import { UnknownAssetError } from "../writer/errors/UnknownAssetError.ts";
import {
  silentLogger,
  type Logger
} from "../logger.ts";
import { TagName } from "./TagName.ts";
import { InvalidTagMessageError } from "./errors/InvalidTagMessageError.ts";
import { UnknownTagError } from "./errors/UnknownTagError.ts";
import { UnrestorableTagError } from "./errors/UnrestorableTagError.ts";
import {
  TAG_MESSAGE_MAX_LENGTH,
  type AssetTag,
  type RestoreReport
} from "./AssetTags.schema.ts";

// CONSTANTS
const kRestoreActor: EventStore.Actor = {
  type: "system",
  source: "restore"
};

export type AssetTagsEventMap = {
  changed: (
    assetId: string
  ) => void;
};

export interface CreateTagInput {
  assetId: string;
  name: string;
  /**
   * At most `TAG_MESSAGE_MAX_LENGTH` characters.
   */
  message?: string;
  actor: EventStore.Actor;
}

export interface RestoreTagInput {
  assetId: string;
  name: string;
  actor: EventStore.Actor;
}

export interface AssetTagsOptions {
  eventStore: EventStore.TypedEventStore<AssetEventDataMap>;
  projector: Pick<AssetProjector, "desired">;
  writer: Pick<AssetWriter, "update">;
  flush: (assetId: string) => Promise<void>;
  objects: Pick<ContentObjects, "store">;
  logger?: Logger;
}

type AssetWriteEvent = Extract<
  AssetEvent,
  { eventType: typeof ASSET_CREATED | typeof ASSET_UPDATED; }
>;

interface TaggedContent {
  path: string;
  hash: string;
  size: number;
}

interface Checkpoint {
  event: AssetWriteEvent;
  head: number;
}

interface CheckpointTag {
  name: TagName;
  message?: string;
  actor: EventStore.Actor;
}

export class AssetTags extends Emitter<AssetTagsEventMap> {
  #eventStore: EventStore.TypedEventStore<AssetEventDataMap>;
  #projector: Pick<AssetProjector, "desired">;
  #writer: Pick<AssetWriter, "update">;
  #flush: (assetId: string) => Promise<void>;
  #objects: Pick<ContentObjects, "store">;
  #logger: Logger;
  #contents = new Map<string, TaggedContent | null>();

  constructor(
    options: AssetTagsOptions
  ) {
    super();
    this.#eventStore = options.eventStore;
    this.#projector = options.projector;
    this.#writer = options.writer;
    this.#flush = options.flush;
    this.#objects = options.objects;
    this.#logger = options.logger ?? silentLogger();
  }

  async create(
    input: CreateTagInput
  ): Promise<Result<AssetTag, Error>> {
    const name = TagName.parse(input.name);
    if (!name.ok) {
      return name;
    }
    if (
      input.message !== undefined &&
      input.message.length > TAG_MESSAGE_MAX_LENGTH
    ) {
      const error = new InvalidTagMessageError(
        input.message.length,
        TAG_MESSAGE_MAX_LENGTH
      );

      return Err(error);
    }

    const checkpoint = await this.#settledCheckpoint(input.assetId);
    if (!checkpoint.ok) {
      return checkpoint;
    }

    const { event } = checkpoint.val;
    const tag = this.#tagCheckpoint(event, {
      name: name.val,
      message: input.message,
      actor: input.actor
    });
    if (tag.ok) {
      await this.#backUp(event, tag.val);
    }

    return tag;
  }

  list(
    assetId: string
  ): AssetTag[] {
    const tags: AssetTag[] = [];
    for (const tag of this.#eventStore.tags.list(assetId)) {
      const content = this.#content(tag);
      if (content !== null) {
        tags.push(toAssetTag(tag, content));
      }
    }

    return tags;
  }

  async restore(
    input: RestoreTagInput
  ): Promise<Result<RestoreReport, Error>> {
    const { assetId, name } = input;
    const tag = this.#eventStore.tags.get(assetId, name);
    if (tag === undefined) {
      const error = new UnknownTagError(assetId, name);

      return Err(error);
    }

    const checkpoint = await this.#settledCheckpoint(assetId);
    if (!checkpoint.ok) {
      return checkpoint;
    }

    const tagged = parseWriteEvent(
      this.#eventStore.reader.get(assetId, tag.eventVersion)
    );
    if (tagged === null) {
      const error = new UnrestorableTagError(assetId, name);

      return Err(error);
    }

    const { event: current, head } = checkpoint.val;
    if (tagged.eventData.hash === current.eventData.hash) {
      return Ok({
        restored: false,
        missing: []
      });
    }

    const restorePoint = this.#restorePoint(current, name);
    if (!restorePoint.ok) {
      return restorePoint;
    }

    const { content, dependencies } = tagged.eventData;
    const updated = await this.#writer.update({
      assetId,
      data: decodeContent(content),
      dependencies,
      actor: input.actor,
      expectedVersion: head,
      restoredFrom: {
        name,
        eventVersion: tag.eventVersion
      }
    });
    if (restorePoint.val !== null) {
      await this.#backUp(current, restorePoint.val);
    }
    if (!updated.ok) {
      return updated;
    }

    await this.#flush(assetId);

    return Ok({
      restored: true,
      ...(restorePoint.val === null ? {} : { restorePoint: restorePoint.val }),
      missing: (dependencies ?? [])
        .filter((reference) => this.#projector.desired(reference.id) === null)
        .map((reference) => {
          return { ...reference };
        })
    });
  }

  delete(
    assetId: string,
    name: string
  ): Result<void, UnknownTagError> {
    if (!this.#eventStore.tags.delete(assetId, name)) {
      const error = new UnknownTagError(assetId, name);

      return Err(error);
    }

    this.emit("changed", assetId);

    return Ok(undefined);
  }

  async #settledCheckpoint(
    assetId: string
  ): Promise<Result<Checkpoint, UnknownAssetError>> {
    await this.#flush(assetId);
    const events = this.#eventStore.reader.listFromCheckpoints({
      assetId,
      checkpointEventTypes: ASSET_CHECKPOINT_EVENT_TYPES
    });
    const event = parseWriteEvent(events[0]);
    if (event === null) {
      const error = new UnknownAssetError(assetId);

      return Err(error);
    }

    return Ok({
      event,
      head: events[events.length - 1].eventVersion
    });
  }

  #restorePoint(
    checkpoint: AssetWriteEvent,
    restoredName: string
  ): Result<AssetTag | null, Error> {
    const { assetId, eventVersion } = checkpoint;
    const tagged = this.#eventStore.tags
      .list(assetId)
      .some((tag) => tag.eventVersion === eventVersion);
    if (tagged) {
      return Ok(null);
    }

    return this.#tagCheckpoint(checkpoint, {
      name: TagName.restorePoint(eventVersion),
      message: `Before restoring "${restoredName}"`,
      actor: kRestoreActor
    });
  }

  #tagCheckpoint(
    checkpoint: AssetWriteEvent,
    input: CheckpointTag
  ): Result<AssetTag, Error> {
    const { assetId, eventVersion } = checkpoint;
    const created = this.#eventStore.tags.create({
      assetId,
      name: input.name.value,
      eventVersion,
      message: input.message,
      actor: input.actor
    });
    if (!created.ok) {
      return created;
    }

    const tag = toAssetTag(created.val, this.#remember(checkpoint));
    this.emit("changed", assetId);

    return Ok(tag);
  }

  async #backUp(
    event: AssetWriteEvent,
    tag: AssetTag
  ): Promise<void> {
    const { assetId, eventData } = event;
    try {
      await this.#objects.store(decodeContent(eventData.content), {
        assetId,
        path: eventData.path,
        reason: "tag",
        tag: {
          name: tag.name,
          message: tag.message
        }
      });
    }
    catch (error) {
      this.#logger
        .withMetadata({
          assetId,
          tag: tag.name,
          reason: asError(error).message
        })
        .warn("tag content not backed up");
    }
  }

  #content(
    tag: EventStore.EventTag
  ): TaggedContent | null {
    const key = contentKey(tag.assetId, tag.eventVersion);
    const cached = this.#contents.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const event = parseWriteEvent(
      this.#eventStore.reader.get(tag.assetId, tag.eventVersion)
    );
    if (event !== null) {
      return this.#remember(event);
    }

    this.#contents.set(key, null);
    this.#logger
      .withMetadata({
        assetId: tag.assetId,
        tag: tag.name,
        eventVersion: tag.eventVersion
      })
      .warn("tag does not point at saved content");

    return null;
  }

  #remember(
    event: AssetWriteEvent
  ): TaggedContent {
    const { path, hash, size } = event.eventData;
    const content = {
      path,
      hash,
      size
    };
    this.#contents.set(contentKey(event.assetId, event.eventVersion), content);

    return content;
  }
}

function parseWriteEvent(
  event: EventStore.Event | undefined
): AssetWriteEvent | null {
  if (event === undefined) {
    return null;
  }

  const parsed = parseAssetEvent(event);
  if (!parsed.ok) {
    return null;
  }

  const { val } = parsed;

  return val.eventType === ASSET_CREATED || val.eventType === ASSET_UPDATED ?
    val :
    null;
}

function toAssetTag(
  tag: EventStore.EventTag,
  content: TaggedContent
): AssetTag {
  return {
    ...tag,
    ...content
  };
}

function contentKey(
  assetId: string,
  eventVersion: number
): string {
  return `${eventVersion}:${assetId}`;
}
