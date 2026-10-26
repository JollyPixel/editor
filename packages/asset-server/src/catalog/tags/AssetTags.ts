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
  partRefs,
  type AssetEvent,
  type AssetEventDataMap
} from "../../model/events/AssetEvents.ts";
import { decodeContent } from "../../model/events/inlineContent.ts";
import { AssetPartContents } from "../../model/events/AssetPartContents.ts";
import type { AssetProjector } from "../../storage/projection/AssetProjector.ts";
import type { AssetWriter } from "../../storage/writer/AssetWriter.ts";
import type { AssetBackups } from "../../storage/AssetBackups.ts";
import { AssetPartFiles } from "../../storage/AssetPartFiles.ts";
import type { AssetKindRegistry } from "../../model/kinds/AssetKindRegistry.ts";
import { asError } from "../../common/asError.ts";
import { UnknownAssetError } from "../../storage/writer/errors/UnknownAssetError.ts";
import {
  silentLogger,
  type Logger
} from "../../common/logger.ts";
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

export interface TaggedVersion {
  readonly eventVersion: number;
  readonly data: Uint8Array;
  /**
   * Every part of the tagged content, for a kind that declares parts.
   */
  readonly parts?: ReadonlyMap<string, Uint8Array>;
}

export interface AssetTagsOptions {
  eventStore: EventStore.TypedEventStore<AssetEventDataMap>;
  projector: Pick<AssetProjector, "desired">;
  writer: Pick<AssetWriter, "update">;
  flush: (assetId: string) => Promise<void>;
  backups: Pick<AssetBackups, "add">;
  kinds: AssetKindRegistry;
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
  #backups: Pick<AssetBackups, "add">;
  #partFiles: AssetPartFiles;
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
    this.#backups = options.backups;
    this.#partFiles = new AssetPartFiles(options.kinds);
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

  read(
    assetId: string,
    name: string
  ): Result<TaggedVersion, UnknownTagError | UnrestorableTagError> {
    const tagged = this.#taggedEvent(assetId, name);
    if (!tagged.ok) {
      return tagged;
    }

    const { eventVersion, eventData } = tagged.val;

    return Ok({
      eventVersion,
      data: decodeContent(eventData.content),
      ...(eventData.parts === undefined ?
        {} :
        { parts: this.#parts(tagged.val) })
    });
  }

  async restore(
    input: RestoreTagInput
  ): Promise<Result<RestoreReport, Error>> {
    const { assetId, name } = input;
    const found = this.#taggedEvent(assetId, name);
    if (!found.ok) {
      return found;
    }

    const checkpoint = await this.#settledCheckpoint(assetId);
    if (!checkpoint.ok) {
      return checkpoint;
    }

    const tagged = found.val;
    const { event: current, head } = checkpoint.val;
    if (sameContent(tagged, current)) {
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
      ...(tagged.eventData.parts === undefined ?
        {} :
        { parts: this.#parts(tagged, current) }),
      dependencies,
      actor: input.actor,
      expectedVersion: head,
      restoredFrom: {
        name,
        eventVersion: tagged.eventVersion
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

  #taggedEvent(
    assetId: string,
    name: string
  ): Result<AssetWriteEvent, UnknownTagError | UnrestorableTagError> {
    const tag = this.#eventStore.tags.get(assetId, name);
    if (tag === undefined) {
      const error = new UnknownTagError(assetId, name);

      return Err(error);
    }

    const event = parseWriteEvent(
      this.#eventStore.reader.get(assetId, tag.eventVersion)
    );
    if (event === null) {
      const error = new UnrestorableTagError(assetId, name);

      return Err(error);
    }

    return Ok(event);
  }

  #parts(
    event: AssetWriteEvent,
    unchanged?: AssetWriteEvent
  ): Map<string, Uint8Array> {
    const held = unchanged === undefined ?
      new Map() :
      partRefs(unchanged.eventData, unchanged.eventVersion);
    const contents = new AssetPartContents(
      this.#eventStore.reader,
      event.assetId
    );
    const parts = new Map<string, Uint8Array>();
    for (const [partId, ref] of partRefs(event.eventData, event.eventVersion)) {
      if (held.get(partId)?.hash !== ref.hash) {
        parts.set(partId, contents.read(partId, ref.at));
      }
    }

    return parts;
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
    const backups = new Map([[eventData.path, decodeContent(eventData.content)]]);
    const extension = this.#partFiles.extension(eventData.kind);
    if (extension !== null && eventData.parts !== undefined) {
      for (const [partId, data] of this.#parts(event)) {
        backups.set(this.#partFiles.path(eventData.path, extension, partId), data);
      }
    }
    try {
      for (const [path, data] of backups) {
        await this.#backups.add(data, {
          assetId,
          path,
          reason: "tag",
          tag: {
            name: tag.name,
            message: tag.message
          }
        });
      }
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

function sameContent(
  left: AssetWriteEvent,
  right: AssetWriteEvent
): boolean {
  if (left.eventData.hash !== right.eventData.hash) {
    return false;
  }

  const leftParts = partRefs(left.eventData, left.eventVersion);
  const rightParts = partRefs(right.eventData, right.eventVersion);

  return leftParts.size === rightParts.size &&
    [...leftParts].every(([partId, ref]) => rightParts.get(partId)?.hash === ref.hash);
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
