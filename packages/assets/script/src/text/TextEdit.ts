// Import Internal Dependencies
import { TextEditMismatchError } from "./errors/TextEditMismatchError.ts";

// CONSTANTS
const kCancelled: TextChange = Object.freeze({ at: 0, insert: "" });

export interface TextInsertion {
  readonly at: number;
  readonly insert: string;
}

export interface TextDeletion {
  readonly at: number;
  readonly delete: string;
}

export type TextChange = TextInsertion | TextDeletion;

export type CaretSide = "before" | "after";

export interface RebasedEdit {
  readonly edit: TextEdit;
  readonly earlier: TextEdit;
}

type ChangePair = readonly [readonly TextChange[], readonly TextChange[]];

export class TextEdit {
  static readonly empty = new TextEdit([]);

  static insertion(
    at: number,
    text: string
  ): TextEdit {
    return new TextEdit([{ at, insert: text }]);
  }

  static deletion(
    at: number,
    text: string
  ): TextEdit {
    return new TextEdit([{ at, delete: text }]);
  }

  static between(
    before: string,
    after: string,
    caret = after.length
  ): TextEdit {
    const prefixLimit = Math.min(before.length, after.length, caret);
    let start = 0;
    while (start < prefixLimit && before[start] === after[start]) {
      start++;
    }

    let beforeEnd = before.length;
    let afterEnd = after.length;
    while (
      beforeEnd > start &&
      afterEnd > start &&
      before[beforeEnd - 1] === after[afterEnd - 1]
    ) {
      beforeEnd--;
      afterEnd--;
    }

    return new TextEdit([
      { at: start, delete: before.slice(start, beforeEnd) },
      { at: start, insert: after.slice(start, afterEnd) }
    ]);
  }

  readonly changes: readonly TextChange[];

  constructor(
    changes: Iterable<TextChange>
  ) {
    const kept: TextChange[] = [];
    for (const change of changes) {
      if (changedText(change) !== "") {
        kept.push(Object.freeze({ ...change }));
      }
    }
    this.changes = Object.freeze(kept);
  }

  get empty(): boolean {
    return this.changes.length === 0;
  }

  fits(
    text: string
  ): boolean {
    return this.#applied(text) !== null;
  }

  applyTo(
    text: string
  ): string {
    let current = text;
    for (const change of this.changes) {
      const next = applyChange(current, change);
      if (next === null) {
        throw new TextEditMismatchError(change.at);
      }
      current = next;
    }

    return current;
  }

  invert(): TextEdit {
    return new TextEdit(this.changes.toReversed().map(
      (change): TextChange => (
        "insert" in change ?
          { at: change.at, delete: change.insert } :
          { at: change.at, insert: change.delete }
      )
    ));
  }

  then(
    next: TextEdit
  ): TextEdit {
    const changes = [...this.changes];
    for (const change of next.changes) {
      const last = changes.at(-1);
      const merged = last === undefined ? null : mergeChanges(last, change);
      if (merged === null) {
        changes.push(change);
      }
      else {
        changes.pop();
        if (merged !== kCancelled) {
          changes.push(merged);
        }
      }
    }

    return new TextEdit(changes);
  }

  rebaseOnto(
    earlier: TextEdit
  ): RebasedEdit {
    const [edit, rebasedEarlier] = transformMany(this.changes, earlier.changes);

    return {
      edit: new TextEdit(edit),
      earlier: new TextEdit(rebasedEarlier)
    };
  }

  mapPosition(
    position: number,
    side: CaretSide = "after"
  ): number {
    let mapped = position;
    for (const change of this.changes) {
      if ("insert" in change) {
        if (change.at < mapped || (change.at === mapped && side === "after")) {
          mapped += change.insert.length;
        }
      }
      else if (mapped >= change.at + change.delete.length) {
        mapped -= change.delete.length;
      }
      else if (mapped > change.at) {
        mapped = change.at;
      }
    }

    return mapped;
  }

  toJSON(): TextChange[] {
    return this.changes.map((change) => {
      return { ...change };
    });
  }

  #applied(
    text: string
  ): string | null {
    let current: string | null = text;
    for (const change of this.changes) {
      current = applyChange(current, change);
      if (current === null) {
        return null;
      }
    }

    return current;
  }
}

function changedText(
  change: TextChange
): string {
  return "insert" in change ? change.insert : change.delete;
}

function applyChange(
  text: string,
  change: TextChange
): string | null {
  if (!Number.isInteger(change.at) || change.at < 0 || change.at > text.length) {
    return null;
  }
  if ("insert" in change) {
    return text.slice(0, change.at) + change.insert + text.slice(change.at);
  }

  const end = change.at + change.delete.length;
  if (text.slice(change.at, end) !== change.delete) {
    return null;
  }

  return text.slice(0, change.at) + text.slice(end);
}

function mergeChanges(
  last: TextChange,
  next: TextChange
): TextChange | null {
  if ("insert" in last) {
    const end = last.at + last.insert.length;
    if ("insert" in next) {
      return next.at >= last.at && next.at <= end ?
        {
          at: last.at,
          insert: last.insert.slice(0, next.at - last.at) +
            next.insert +
            last.insert.slice(next.at - last.at)
        } :
        null;
    }
    if (next.at < last.at || next.at + next.delete.length > end) {
      return null;
    }

    const offset = next.at - last.at;
    const insert = last.insert.slice(0, offset) +
      last.insert.slice(offset + next.delete.length);

    return insert === "" ? kCancelled : { at: last.at, insert };
  }
  if (!("delete" in next)) {
    return null;
  }
  if (next.at === last.at) {
    return { at: last.at, delete: last.delete + next.delete };
  }
  if (next.at + next.delete.length === last.at) {
    return { at: next.at, delete: next.delete + last.delete };
  }

  return null;
}

function transformMany(
  later: readonly TextChange[],
  earlier: readonly TextChange[]
): ChangePair {
  if (later.length === 0 || earlier.length === 0) {
    return [later, earlier];
  }
  if (later.length === 1 && earlier.length === 1) {
    return transformPair(later[0], earlier[0]);
  }
  if (later.length > 1) {
    const [head, headEarlier] = transformMany(later.slice(0, 1), earlier);
    const [rest, restEarlier] = transformMany(later.slice(1), headEarlier);

    return [[...head, ...rest], restEarlier];
  }

  const [laterHead, head] = transformMany(later, earlier.slice(0, 1));
  const [laterRest, rest] = transformMany(laterHead, earlier.slice(1));

  return [laterRest, [...head, ...rest]];
}

function transformPair(
  later: TextChange,
  earlier: TextChange
): ChangePair {
  if ("insert" in later) {
    if ("insert" in earlier) {
      return earlier.at <= later.at ?
        [[shift(later, earlier.insert.length)], [earlier]] :
        [[later], [shift(earlier, later.insert.length)]];
    }

    return insertionAcrossDeletion(later, earlier);
  }
  if ("insert" in earlier) {
    const [deletion, insertion] = insertionAcrossDeletion(earlier, later);

    return [insertion, deletion];
  }

  return deletionAcrossDeletion(later, earlier);
}

function insertionAcrossDeletion(
  insertion: TextInsertion,
  deletion: TextDeletion
): ChangePair {
  const end = deletion.at + deletion.delete.length;
  if (insertion.at <= deletion.at) {
    return [[insertion], [shift(deletion, insertion.insert.length)]];
  }
  if (insertion.at >= end) {
    return [[shift(insertion, -deletion.delete.length)], [deletion]];
  }

  const split = insertion.at - deletion.at;

  return [
    [{ at: deletion.at, insert: insertion.insert }],
    [
      { at: deletion.at, delete: deletion.delete.slice(0, split) },
      { at: deletion.at + insertion.insert.length, delete: deletion.delete.slice(split) }
    ]
  ];
}

function deletionAcrossDeletion(
  later: TextDeletion,
  earlier: TextDeletion
): ChangePair {
  const laterEnd = later.at + later.delete.length;
  const earlierEnd = earlier.at + earlier.delete.length;
  if (laterEnd <= earlier.at) {
    return [[later], [shift(earlier, -later.delete.length)]];
  }
  if (earlierEnd <= later.at) {
    return [[shift(later, -earlier.delete.length)], [earlier]];
  }

  const overlapStart = Math.max(later.at, earlier.at);
  const overlapEnd = Math.min(laterEnd, earlierEnd);
  const at = Math.min(later.at, earlier.at);

  return [
    withoutOverlap(later, overlapStart, overlapEnd, at),
    withoutOverlap(earlier, overlapStart, overlapEnd, at)
  ];
}

function withoutOverlap(
  deletion: TextDeletion,
  overlapStart: number,
  overlapEnd: number,
  at: number
): TextChange[] {
  const text = deletion.delete.slice(0, overlapStart - deletion.at) +
    deletion.delete.slice(overlapEnd - deletion.at);

  return text === "" ? [] : [{ at, delete: text }];
}

function shift<TChange extends TextChange>(
  change: TChange,
  offset: number
): TChange {
  return {
    ...change,
    at: change.at + offset
  };
}
