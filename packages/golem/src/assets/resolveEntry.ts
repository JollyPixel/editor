// Import Internal Dependencies
import {
  UnknownEntryError,
  type EntryKind
} from "./errors/UnknownEntryError.ts";

export interface NamedEntry {
  readonly id: string;
  readonly name: string;
}

export function resolveEntry<TEntry extends NamedEntry>(
  entry: EntryKind,
  nameOrId: string,
  entries: Iterable<TEntry>,
  describe: (match: TEntry) => string = (match) => match.id
): TEntry {
  const all = [...entries];
  const byId = all.find(({ id }) => id === nameOrId);
  if (byId !== undefined) {
    return byId;
  }

  const matches = all.filter(({ name }) => name === nameOrId);
  if (matches.length !== 1) {
    throw new UnknownEntryError(entry, nameOrId, matches.map(describe));
  }

  return matches[0];
}
