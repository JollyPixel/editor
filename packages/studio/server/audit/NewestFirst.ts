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
  iterator: Iterator<AuditItem>;
  item: AuditItem;
}

export class NewestFirst implements Iterable<SourcedItem> {
  #sources: ReadonlyMap<AuditSourceName, Iterable<AuditItem>>;

  constructor(
    sources: ReadonlyMap<AuditSourceName, Iterable<AuditItem>>
  ) {
    this.#sources = sources;
  }

  * [Symbol.iterator](): IterableIterator<SourcedItem> {
    const heads: Head[] = [];
    for (const [source, items] of this.#sources) {
      const iterator = items[Symbol.iterator]();
      const item = next(iterator);
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

      const item = next(newest.iterator);
      if (item === null) {
        heads.splice(heads.indexOf(newest), 1);
      }
      else {
        newest.item = item;
      }
    }
  }
}

function next(
  iterator: Iterator<AuditItem>
): AuditItem | null {
  const result = iterator.next();

  return result.done ? null : result.value;
}
