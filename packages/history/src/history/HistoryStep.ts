// Import Internal Dependencies
import type {
  HistoryRefusal,
  HistoryStepInfo
} from "./HistoryState.ts";
import {
  PartDraft,
  type HistoryPart,
  type PartRegistration
} from "./HistoryPart.ts";
import type { PartBasis } from "./PartBasis.ts";

export class HistoryStep<TScope extends string> {
  readonly scope: TScope;
  readonly source: HistoryStep<TScope> | null;

  #label: string | null;
  #drafts = new Map<string, PartDraft>();
  #parts = new Map<string, HistoryPart>();
  #info: HistoryStepInfo | null = null;

  constructor(
    scope: TScope,
    label: string | null,
    source: HistoryStep<TScope> | null = null
  ) {
    this.scope = scope;
    this.#label = label;
    this.source = source;
  }

  get label(): string | null {
    return this.#label;
  }

  get info(): HistoryStepInfo | null {
    return this.#info;
  }

  get refused(): boolean {
    return this.#info !== null;
  }

  get empty(): boolean {
    return this.#parts.size === 0;
  }

  collect(
    documentId: string,
    inverse: readonly unknown[],
    label: () => string | null
  ): PartBasis {
    this.#label ??= label();
    let draft = this.#drafts.get(documentId);
    if (draft === undefined) {
      draft = new PartDraft();
      this.#drafts.set(documentId, draft);
    }
    draft.prepend(inverse);

    return draft.basis;
  }

  file(
    registrationOf: (documentId: string) => PartRegistration | undefined
  ): void {
    for (const [documentId, draft] of this.#drafts) {
      const registration = registrationOf(documentId);
      if (registration !== undefined) {
        this.#parts.set(documentId, draft.file(registration));
      }
    }
    this.#drafts.clear();
  }

  rebind(
    documentId: string,
    registration: PartRegistration
  ): void {
    this.#parts.get(documentId)?.rebind(registration);
  }

  recapture(
    documentId: string,
    written: unknown
  ): void {
    const part = this.#parts.get(documentId);
    if (part?.touches(written) === true) {
      part.recapture();
    }
  }

  overwrittenBy(
    documentId: string,
    written: unknown
  ): boolean {
    return this.#settled(documentId)?.touches(written) === true;
  }

  changedIn(
    documentId: string
  ): boolean {
    return this.#settled(documentId)?.changed() === true;
  }

  blocker(
    isOpen: (documentId: string) => boolean
  ): HistoryRefusal | null {
    for (const documentId of this.#parts.keys()) {
      if (!isOpen(documentId)) {
        return {
          reason: "closed",
          documentId
        };
      }
    }
    for (const part of this.#parts.values()) {
      if (part.changed()) {
        return { reason: "changed" };
      }
    }

    return null;
  }

  replay(): boolean {
    let applied = false;
    for (const part of [...this.#parts.values()].toReversed()) {
      applied = part.replay() || applied;
    }

    return applied;
  }

  refuse(
    refusal: HistoryRefusal
  ): HistoryStepInfo {
    this.#info = {
      label: this.#label,
      refused: refusal
    };

    return this.#info;
  }

  discard(): void {
    for (const draft of this.#drafts.values()) {
      draft.basis.drop();
    }
    for (const part of this.#parts.values()) {
      part.basis.drop();
    }
    this.source?.discard();
  }

  #settled(
    documentId: string
  ): HistoryPart | undefined {
    const part = this.#parts.get(documentId);

    return part?.basis.pending === false ? part : undefined;
  }
}
