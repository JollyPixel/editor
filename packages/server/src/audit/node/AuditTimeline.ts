// Import Third-party Dependencies
import * as z from "zod";

// Import Internal Dependencies
import type { AssetLog } from "./AssetLog.ts";
import type { AuditItem } from "./AuditEntry.ts";
import type { AuditLog } from "./AuditLog.ts";

// CONSTANTS
const kPositionsSchema = z.object({
  events: z.number().optional(),
  audit: z.number().optional(),
  tags: z.string().optional()
});

type AuditPositions = z.infer<typeof kPositionsSchema>;
type AuditSourceName = keyof AuditPositions;

interface Head {
  source: AuditSourceName;
  iterator: AsyncIterator<AuditItem>;
  item: AuditItem;
}

export interface AuditTimelineSources {
  assets: AssetLog;
  audit: AuditLog;
}

export class AuditTimeline implements AsyncIterable<AuditItem> {
  #sources: AuditTimelineSources;
  #start: AuditPositions;
  #consumed: Partial<Record<AuditSourceName, number | string>>;

  constructor(
    sources: AuditTimelineSources,
    cursor: string | undefined
  ) {
    this.#sources = sources;
    this.#start = decode(cursor);
    this.#consumed = { ...this.#start };
  }

  cursor(): string {
    return Buffer.from(JSON.stringify(this.#consumed)).toString("base64url");
  }

  async* [Symbol.asyncIterator](): AsyncIterableIterator<AuditItem> {
    const { assets, audit } = this.#sources;
    const heads = await openHeads([
      ["events", assets.events(this.#start.events)],
      ["audit", audit.events(this.#start.audit)],
      ["tags", assets.tags(this.#start.tags)]
    ]);

    while (heads.length > 0) {
      const newest = heads.reduce(
        (current, head) => (head.item.at > current.item.at ? head : current)
      );
      yield newest.item;
      this.#consumed[newest.source] = newest.item.position;

      const result = await newest.iterator.next();
      if (result.done) {
        heads.splice(heads.indexOf(newest), 1);
      }
      else {
        newest.item = result.value;
      }
    }
  }
}

function decode(
  cursor: string | undefined
): AuditPositions {
  if (cursor === undefined || cursor === "") {
    return {};
  }

  try {
    const parsed = kPositionsSchema.safeParse(
      JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"))
    );

    return parsed.success ? parsed.data : {};
  }
  catch {
    return {};
  }
}

async function openHeads(
  sources: [AuditSourceName, AsyncIterable<AuditItem>][]
): Promise<Head[]> {
  const heads: Head[] = [];
  for (const [source, items] of sources) {
    const iterator = items[Symbol.asyncIterator]();
    const result = await iterator.next();
    if (!result.done) {
      heads.push({
        source,
        iterator,
        item: result.value
      });
    }
  }

  return heads;
}
