// Import Internal Dependencies
import type {
  HistoryGuard,
  HistoryKeys
} from "./HistoryRegistration.ts";
import type {
  HistoryRefusal,
  HistoryStepInfo
} from "./HistoryState.ts";
import { PartBasis } from "./PartBasis.ts";

type AnyKeys = HistoryKeys<unknown, unknown, unknown, unknown>;

export class HistoryPart {
  readonly documentId: string;
  readonly commands: unknown[] = [];
  readonly basis = new PartBasis();

  #guard: HistoryGuard<unknown, unknown> | null = null;
  #guardedBy: AnyKeys | null = null;
  #captured: unknown = undefined;

  constructor(
    documentId: string
  ) {
    this.documentId = documentId;
  }

  prepend(
    inverse: readonly unknown[]
  ): void {
    this.commands.unshift(...inverse);
  }

  rewrite(
    commands: readonly unknown[]
  ): void {
    this.commands.length = 0;
    for (const command of commands) {
      this.commands.push(command);
    }
  }

  capture(
    keys: AnyKeys
  ): void {
    this.#captured = this.#guardOf(
      keys
    ).capture();
  }

  touches(
    keys: AnyKeys,
    written: unknown
  ): boolean {
    return this.#guardOf(keys).touches(written);
  }

  changed(
    keys: AnyKeys
  ): boolean {
    return !this.#guardOf(keys).same(this.#captured);
  }

  #guardOf(
    keys: AnyKeys
  ): HistoryGuard<unknown, unknown> {
    if (
      this.#guard === null ||
      this.#guardedBy !== keys
    ) {
      this.#guard = keys.guard(this.commands);
      this.#guardedBy = keys;
    }

    return this.#guard;
  }
}

export class HistoryStep<TScope extends string> {
  readonly scope: TScope;
  readonly parts = new Map<string, HistoryPart>();
  readonly source: HistoryStep<TScope> | null;
  label: string | null;

  #info: HistoryStepInfo | null = null;

  constructor(
    scope: TScope,
    label: string | null,
    source: HistoryStep<TScope> | null = null
  ) {
    this.scope = scope;
    this.label = label;
    this.source = source;
  }

  get info(): HistoryStepInfo | null {
    return this.#info;
  }

  get refused(): boolean {
    return this.#info !== null;
  }

  part(
    documentId: string
  ): HistoryPart {
    let part = this.parts.get(documentId);
    if (part === undefined) {
      part = new HistoryPart(documentId);
      this.parts.set(
        documentId,
        part
      );
    }

    return part;
  }

  refuse(
    refusal: HistoryRefusal
  ): HistoryStepInfo {
    this.#info = {
      label: this.label,
      refused: refusal
    };

    return this.#info;
  }

  * lineage(): IterableIterator<HistoryStep<TScope>> {
    yield this;
    if (this.source !== null) {
      yield* this.source.lineage();
    }
  }
}
