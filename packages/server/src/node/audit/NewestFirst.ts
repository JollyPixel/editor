// Import Internal Dependencies
import type {
  AuditItem,
  AuditSourceName
} from "./AuditEntry.ts";

export interface SourcedItem {
  source: AuditSourceName;
  item: AuditItem;
}

interface Head {
  source: AuditSourceName;
  iterator: AsyncIterator<AuditItem>;
  item: AuditItem;
}

export class NewestFirst implements AsyncIterable<SourcedItem> {
  #sources: ReadonlyMap<AuditSourceName, AsyncIterable<AuditItem>>;

  constructor(
    sources: ReadonlyMap<AuditSourceName, AsyncIterable<AuditItem>>
  ) {
    this.#sources = sources;
  }

  async* [Symbol.asyncIterator](): AsyncIterableIterator<SourcedItem> {
    const heads: Head[] = [];
    for (const [source, items] of this.#sources) {
      const iterator = items[Symbol.asyncIterator]();
      const item = await next(iterator);
      if (item !== null) {
        heads.push({
          source,
          iterator,
          item
        });
      }
    }

    while (heads.length > 0) {
      const newest = heads.reduce(
        (current, head) => (head.item.at > current.item.at ? head : current)
      );
      yield {
        source: newest.source,
        item: newest.item
      };

      const item = await next(newest.iterator);
      if (item === null) {
        heads.splice(heads.indexOf(newest), 1);
      }
      else {
        newest.item = item;
      }
    }
  }
}

async function next(
  iterator: AsyncIterator<AuditItem>
): Promise<AuditItem | null> {
  const result = await iterator.next();

  return result.done ? null : result.value;
}
