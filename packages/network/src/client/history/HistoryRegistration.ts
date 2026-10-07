// Import Internal Dependencies
import type { CommandChange } from "../command/CommandDocument.ts";
import type { ChangeReceipts } from "./ChangeReceipts.ts";

export interface HistoryGuard {
  readonly key: string;
  /** The value behind the key, compared as JSON; `undefined` when there is none. */
  read(): unknown;
}

export interface HistoryKeys<TCommand, TImage> {
  /** The keys a change wrote, including keys of the entries that contain what it touched. */
  written(change: CommandChange<TCommand, TImage>): readonly string[];
  /** The values replaying `commands` must find unchanged, read from the document as it is now. */
  guards(commands: readonly TCommand[]): readonly HistoryGuard[];
}

export interface HistorySource<TCommand, TImage> {
  readonly receipts: ChangeReceipts<CommandChange<TCommand, TImage>>;
  subscribe(event: "change", listener: (change: CommandChange<TCommand, TImage>) => void): () => void;
  subscribe(event: "reset", listener: () => void): () => void;
  applyStep(command: TCommand, basis: number | undefined): CommandChange<TCommand, TImage> | null;
}

export interface HistoryRegistration<TScope extends string, TCommand, TImage> {
  /** Unique among the documents of one history, e.g. "model" or "set:<id>". */
  id: string;
  document: HistorySource<TCommand, TImage>;
  keys: HistoryKeys<TCommand, TImage>;
  /** The scope a local change files its step in; `null` files none. */
  scopeOf(change: CommandChange<TCommand, TImage>): TScope | null;
  /** Names a step made of this single change; unnamed when omitted. */
  label?(change: CommandChange<TCommand, TImage>): string | null;
}
