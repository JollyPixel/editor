// Import Third-party Dependencies
import {
  Err,
  Ok,
  type Result
} from "@openally/result";

// Import Internal Dependencies
import type {
  CatalogCreateCommand,
  CatalogProgress
} from "../protocol.ts";
import { CatalogContentTooLargeError } from "../errors/CatalogContentTooLargeError.ts";
import { CompanionReplacementError } from "./errors/CompanionReplacementError.ts";
import type { AssetArchive } from "../archive/AssetArchive.ts";
import type { ArchiveLimits } from "../archive/ArchiveLimits.ts";
import { readAssetArchive } from "../archive/readAssetArchive.ts";
import type { AssetKindRegistry } from "../../model/kinds/AssetKindRegistry.ts";
import type {
  CreateAssetFromPayload,
  CreateConvertedAsset
} from "../../storage/writer/AssetWriteInput.ts";

// CONSTANTS
const kCreatedAssetId = "created";

export interface CatalogContentOptions {
  kinds: AssetKindRegistry;
  maxContentBytes: number;
  archiveLimits: ArchiveLimits;
}

export type CreatedContent =
  | Pick<CreateAssetFromPayload, "data">
  | Pick<CreateConvertedAsset, "converted">;

export class CatalogContent {
  #kinds: AssetKindRegistry;
  #maxContentBytes: number;
  #archiveLimits: ArchiveLimits;

  constructor(
    options: CatalogContentOptions
  ) {
    this.#kinds = options.kinds;
    this.#maxContentBytes = options.maxContentBytes;
    this.#archiveLimits = options.archiveLimits;
  }

  async created(
    command: CatalogCreateCommand,
    progress: CatalogProgress
  ): Promise<Result<CreatedContent, Error>> {
    const { content, from } = command;
    if (content === undefined) {
      return Ok({});
    }

    const kind = command.kind ?? this.#kinds.resolve(command.path).kind;
    const checked = this.withinKindLimit(kind, content);
    if (!checked.ok) {
      return checked;
    }

    if (from === undefined) {
      return this.#loadable(kind, checked.val).map(() => {
        return { data: checked.val };
      });
    }

    progress("converting");
    const converted = await this.#kinds.convert(kind, from, checked.val);

    return converted.andThen((asset) => this.#loadable(kind, asset.content).map(() => {
      return { converted: asset };
    }));
  }

  async replacement(
    kind: string,
    content: Uint8Array,
    from: string | undefined
  ): Promise<Result<Uint8Array, Error>> {
    const checked = this.withinKindLimit(kind, content);
    if (!checked.ok || from === undefined) {
      return checked;
    }

    const converted = await this.#kinds.convert(kind, from, checked.val);

    return converted.andThen(({ content: replaced, companions = [] }) => {
      if (companions.length > 0) {
        const error = new CompanionReplacementError(kind, from);

        return Err(error);
      }

      return Ok(replaced);
    });
  }

  archive(
    content: Uint8Array
  ): Result<AssetArchive, Error> {
    return this.withinCatalogLimit(content).andThen(
      (bytes) => readAssetArchive(bytes, this.#archiveLimits)
    );
  }

  withinKindLimit(
    kind: string,
    content: Uint8Array
  ): Result<Uint8Array, Error> {
    const limit = this.#kinds.has(kind) ?
      this.#kinds.get(kind).maxContentBytes :
      undefined;

    return within(content, limit ?? this.#maxContentBytes);
  }

  withinCatalogLimit(
    content: Uint8Array
  ): Result<Uint8Array, Error> {
    return within(content, this.#maxContentBytes);
  }

  #loadable(
    kind: string,
    content: Uint8Array
  ): Result<unknown, Error> {
    return this.#kinds.has(kind) ?
      this.#kinds.decode(kind, kCreatedAssetId, content) :
      Ok(undefined);
  }
}

function within(
  content: Uint8Array,
  limit: number
): Result<Uint8Array, Error> {
  if (content.byteLength <= limit) {
    return Ok(content);
  }

  const error = new CatalogContentTooLargeError(
    content.byteLength,
    limit
  );

  return Err(error);
}
