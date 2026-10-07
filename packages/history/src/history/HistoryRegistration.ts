// Import Internal Dependencies
import type { CommandChange } from "../document/CommandChange.ts";
import type { DocumentResetCause } from "../document/CommandDocument.ts";
import type { ChangeReceipts } from "../document/ChangeReceipts.ts";
import type { KeyedSnapshot } from "./KeyedSnapshot.ts";

export interface HistoryGuard<
  TWritten = Iterable<string>,
  TCapture = KeyedSnapshot
> {
  touches(
    written: TWritten
  ): boolean;
  capture(): TCapture;
  same(
    captured: TCapture
  ): boolean;
}

export interface HistoryKeys<
  TCommand,
  TImage,
  TWritten = Iterable<string>,
  TCapture = KeyedSnapshot
> {
  written(
    change: CommandChange<TCommand, TImage>
  ): TWritten;
  guard(
    commands: readonly TCommand[]
  ): HistoryGuard<TWritten, TCapture>;
}

export interface HistorySource<
  TCommand,
  TImage
> {
  readonly receipts: ChangeReceipts<CommandChange<TCommand, TImage>>;
  subscribe(
    event: "change",
    listener: (change: CommandChange<TCommand, TImage>) => void
  ): () => void;
  subscribe(
    event: "reset",
    listener: (cause: DocumentResetCause) => void
  ): () => void;
  applyStep(
    command: TCommand,
    basis: number
  ): CommandChange<TCommand, TImage> | null;
}

export interface HistoryRegistration<
  TScope extends string,
  TCommand,
  TImage,
  TWritten = Iterable<string>,
  TCapture = KeyedSnapshot
> {
  /**
   * Unique among the documents of one history, e.g. "model" or "set:<id>".
   */
  id: string;
  document: HistorySource<TCommand, TImage>;
  keys: HistoryKeys<TCommand, TImage, TWritten, TCapture>;
  scopeOf(
    change: CommandChange<TCommand, TImage>
  ): TScope | null;
  label?(
    change: CommandChange<TCommand, TImage>
  ): string | null;
  compact?(
    commands: readonly TCommand[]
  ): TCommand[];
}
