// Import Internal Dependencies
import {
  CommandDocument,
  type CommandState
} from "./CommandDocument.ts";

interface SnapshotContent<TValue> {
  value: TValue;
}

export class SnapshotDocument<
  TSnapshot,
  TValue = TSnapshot
> extends CommandDocument<never, TSnapshot, null> {
  #content: SnapshotContent<TValue>;

  constructor(
    empty: TValue,
    decode: (snapshot: TSnapshot) => TValue
  ) {
    const content: SnapshotContent<TValue> = {
      value: empty
    };
    super(snapshotState(content, decode));
    this.#content = content;
  }

  get value(): TValue {
    return this.#content.value;
  }
}

function snapshotState<TSnapshot, TValue>(
  content: SnapshotContent<TValue>,
  decode: (snapshot: TSnapshot) => TValue
): CommandState<never, TSnapshot, null> {
  return {
    accepts: () => false,
    placeable: (command) => command,
    apply: () => undefined,
    load: (snapshot) => {
      content.value = decode(snapshot);
    },
    captureImage: () => null,
    invert: () => [],
    restored: () => {
      throw new Error("A snapshot document has no command to rewind.");
    }
  };
}
