// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { CommandChange } from "../document/CommandChange.ts";
import type { HistoryRegistration } from "./HistoryRegistration.ts";
import { HistoryScopes } from "./HistoryScopes.ts";
import type {
  HistoryRefusal,
  HistoryScopeState,
  HistoryStepInfo
} from "./HistoryState.ts";
import {
  HistoryStep,
  type HistoryPart
} from "./HistoryStep.ts";
import type { PartBasis } from "./PartBasis.ts";
import type { StackSide } from "./ScopeStacks.ts";

// CONSTANTS
const kDefaultLimit = 50;
const kJoinedStep: OpenStep = Object.freeze({
  commit: () => undefined,
  cancel: () => undefined
});

export interface OpenStep {
  commit(): void;
  cancel(): void;
}

export type CommandHistoryEvents<
  TScope extends string
> = {
  change: (
    scope: TScope,
    state: HistoryScopeState
  ) => void;
  refused: (
    scope: TScope,
    step: HistoryStepInfo
  ) => void;
  /**
   * An undo or redo passed over a refused step.
   */
  skipped: (
    scope: TScope,
    step: HistoryStepInfo
  ) => void;
};

export interface CommandHistoryOptions<
  TScope extends string
> {
  scopes: readonly TScope[];
  /**
   * Steps kept per stack, the oldest dropped first; 50 by default.
   */
  limit?: number | undefined;
}

type AnyRegistration<
  TScope extends string
> = HistoryRegistration<TScope, unknown, unknown, unknown, unknown>;
type AnyChange = CommandChange<unknown, unknown>;

interface RegisteredDocument<
  TScope extends string
> {
  readonly registration: AnyRegistration<TScope>;
  release(): void;
}

interface Owner<
  TScope extends string
> {
  readonly step: HistoryStep<TScope>;
  readonly basis: PartBasis;
}

export class CommandHistory<
  TScope extends string
> extends Emitter<CommandHistoryEvents<TScope>> {
  #scopes: HistoryScopes<TScope>;
  #documents = new Map<string, RegisteredDocument<TScope>>();
  #recording: HistoryStep<TScope> | null = null;
  #owners = new WeakMap<object, Owner<TScope>>();

  constructor(
    options: CommandHistoryOptions<TScope>
  ) {
    super();
    this.#scopes = new HistoryScopes(
      options.scopes,
      options.limit ?? kDefaultLimit
    );
  }

  get limit(): number {
    return this.#scopes.limit;
  }

  register<TCommand, TImage, TWritten, TCapture>(
    registration: HistoryRegistration<TScope, TCommand, TImage, TWritten, TCapture>
  ): () => void {
    const { id } = registration;
    if (this.#documents.has(id)) {
      throw new Error(`CommandHistory: a document "${id}" is already registered.`);
    }

    const registered: AnyRegistration<TScope> = registration;
    const onConfirmed = (change: AnyChange, version: number | undefined): void => {
      this.#onConfirmed(change, version);
    };
    const onRefused = (change: AnyChange): void => this.#onRefused(change);
    const onDiscarded = (): void => this.#onDiscarded(id);
    const { receipts } = registered.document;
    receipts.on("confirmed", onConfirmed);
    receipts.on("refused", onRefused);
    receipts.on("discarded", onDiscarded);
    const releases = [
      registered.document.subscribe(
        "change",
        (change) => this.#onChange(registered, change)
      ),
      registered.document.subscribe("reset", (cause) => {
        if (cause === "load") {
          this.#onReset(registered);
        }
      }),
      () => receipts.off("confirmed", onConfirmed),
      () => receipts.off("refused", onRefused),
      () => receipts.off("discarded", onDiscarded)
    ];
    this.#documents.set(id, {
      registration: registered,
      release: () => {
        for (const release of releases) {
          release();
        }
      }
    });

    return () => this.#unregister(id);
  }

  record<T>(
    scope: TScope,
    label: string | null,
    edit: () => T
  ): T {
    const step = this.open(scope, label);
    try {
      return edit();
    }
    finally {
      step.commit();
    }
  }

  open(
    scope: TScope,
    label: string | null
  ): OpenStep {
    const stacks = this.#scopes.get(scope);
    if (this.#recording !== null) {
      return kJoinedStep;
    }

    const step = new HistoryStep(scope, label);
    this.#recording = step;
    const close = (file: boolean): void => {
      if (this.#recording !== step) {
        return;
      }

      this.#recording = null;
      if (file && this.#seal(step)) {
        stacks.record(step);
        this.#notify(scope);
      }
    };

    return {
      commit: () => close(true),
      cancel: () => close(false)
    };
  }

  undo(
    scope: TScope
  ): boolean {
    return this.#step(scope, "undo");
  }

  redo(
    scope: TScope
  ): boolean {
    return this.#step(scope, "redo");
  }

  state(
    scope: TScope
  ): HistoryScopeState {
    return this.#scopes.get(scope).state;
  }

  dispose(): void {
    for (const id of [...this.#documents.keys()]) {
      this.#unregister(id);
    }
    this.#scopes.clear();
    this.#recording = null;
    this.removeAllListeners();
  }

  #unregister(
    id: string
  ): void {
    this.#documents.get(id)?.release();
    this.#documents.delete(id);
  }

  #onChange(
    registration: AnyRegistration<TScope>,
    change: AnyChange
  ): void {
    switch (change.origin) {
      case "local":
        this.#settle(registration, change);
        this.#onLocalChange(registration, change);
        break;
      case "remote":
        this.#onPeerChange(registration, change);
        break;
      case "replay":
        this.#settle(registration, change);
        break;
    }
  }

  #onLocalChange(
    registration: AnyRegistration<TScope>,
    change: AnyChange
  ): void {
    if (this.#recording !== null) {
      this.#collect(this.#recording, registration, change);

      return;
    }

    const scope = registration.scopeOf(change);
    if (scope !== null) {
      this.record(
        scope,
        null,
        () => this.#onLocalChange(registration, change)
      );
    }
  }

  #collect(
    step: HistoryStep<TScope>,
    registration: AnyRegistration<TScope>,
    change: AnyChange
  ): void {
    if (change.inverse.length === 0) {
      return;
    }

    step.label ??= registration.label?.(change) ?? null;
    const part = step.part(registration.id);
    part.prepend(change.inverse);
    if (registration.document.receipts.attached) {
      part.basis.expect(change);
      this.#owners.set(change, { step, basis: part.basis });
    }
  }

  #seal(
    step: HistoryStep<TScope>
  ): boolean {
    for (const part of step.parts.values()) {
      const registration = this.#documents.get(part.documentId)?.registration;
      if (
        registration === undefined ||
        part.commands.length === 0
      ) {
        step.parts.delete(part.documentId);
      }
      else {
        if (registration.compact !== undefined) {
          part.rewrite(registration.compact(part.commands));
        }
        part.capture(registration.keys);
      }
    }

    return step.parts.size > 0;
  }

  #settle(
    registration: AnyRegistration<TScope>,
    change: AnyChange
  ): void {
    const written = registration.keys.written(change);
    for (const step of this.#scopes) {
      const part = step.parts.get(registration.id);
      if (
        part !== undefined &&
        part.touches(registration.keys, written)
      ) {
        part.capture(registration.keys);
      }
    }
  }

  #step(
    scope: TScope,
    from: StackSide
  ): boolean {
    if (this.#recording !== null) {
      return false;
    }

    const stacks = this.#scopes.get(scope);
    for (const step of stacks.newestFirst(from)) {
      const info = step.info;
      if (info !== null) {
        this.emit("skipped", scope, info);
        continue;
      }

      const closed = [...step.parts.keys()].find((id) => !this.#documents.has(id));
      if (closed !== undefined) {
        this.emit(
          "skipped",
          scope,
          this.#refuse(step, { reason: "closed", documentId: closed })
        );
        continue;
      }

      if (this.#outdated(step)) {
        this.emit(
          "skipped",
          scope,
          this.#refuse(step, { reason: "changed" })
        );
        continue;
      }

      const taken = stacks.take(step)!;
      if (this.#replay(step, from === "undo" ? "redo" : "undo")) {
        this.#notify(scope);

        return true;
      }

      stacks.insert(taken, step);
      this.emit(
        "skipped",
        scope,
        this.#refuse(step, { reason: "gone" })
      );
    }
    this.#notify(scope);

    return false;
  }

  #outdated(
    step: HistoryStep<TScope>
  ): boolean {
    for (const part of step.parts.values()) {
      if (part.changed(this.#documents.get(part.documentId)!.registration.keys)) {
        return true;
      }
    }

    return false;
  }

  #replay(
    step: HistoryStep<TScope>,
    side: StackSide
  ): boolean {
    const replayed = new HistoryStep(step.scope, step.label, step);
    this.#recording = replayed;
    let applied = false;
    try {
      for (const part of [...step.parts.values()].reverse()) {
        const { document } = this.#documents.get(part.documentId)!.registration;
        for (const command of part.commands) {
          applied = document.applyStep(
            command,
            part.basis.version
          ) !== null || applied;
        }
      }
    }
    finally {
      this.#recording = null;
      if (this.#seal(replayed)) {
        this.#scopes.get(step.scope).push(side, replayed);
      }
    }

    return applied;
  }

  #onPeerChange(
    registration: AnyRegistration<TScope>,
    change: AnyChange
  ): void {
    const written = registration.keys.written(change);
    this.#refuseWhere(
      registration.id,
      (part) => part.touches(registration.keys, written),
      { reason: "peer", clientId: change.clientId }
    );
  }

  #onReset(
    registration: AnyRegistration<TScope>
  ): void {
    this.#refuseWhere(
      registration.id,
      (part) => part.changed(registration.keys),
      { reason: "changed" }
    );
  }

  #refuseWhere(
    documentId: string,
    matches: (part: HistoryPart) => boolean,
    refusal: HistoryRefusal
  ): void {
    const changed = new Set<TScope>();
    for (const step of this.#scopes) {
      const part = step.parts.get(documentId);
      if (
        !step.refused &&
        part !== undefined &&
        !part.basis.pending &&
        matches(part)
      ) {
        this.#refuse(step, refusal);
        changed.add(step.scope);
      }
    }
    for (const scope of changed) {
      this.#notify(scope);
    }
  }

  #refuse(
    step: HistoryStep<TScope>,
    refusal: HistoryRefusal
  ): HistoryStepInfo {
    const info = step.refuse(refusal);
    this.emit("refused", step.scope, info);

    return info;
  }

  #onConfirmed(
    change: AnyChange,
    version: number | undefined
  ): void {
    this.#takeOwner(change)?.basis.confirm(change, version);
  }

  #onRefused(
    change: AnyChange
  ): void {
    const owner = this.#takeOwner(change);
    if (owner?.basis.refuse(change) === true) {
      this.#reject(owner.step, { reason: "server" });
    }
  }

  #onDiscarded(
    documentId: string
  ): void {
    const dropped = [...this.#scopes].filter(
      (step) => step.parts.get(documentId)?.basis.pending === true
    );
    for (const step of dropped) {
      for (const link of step.lineage()) {
        link.parts.get(documentId)?.basis.drop();
      }
      this.#reject(step, { reason: "dropped" });
    }
  }

  #reject(
    step: HistoryStep<TScope>,
    refusal: HistoryRefusal
  ): void {
    if (step.source !== null) {
      this.#restoreReplayed(step, step.source, refusal);
    }
    else if (!step.refused) {
      this.#refuse(step, refusal);
      this.#notify(step.scope);
    }
  }

  #restoreReplayed(
    replayed: HistoryStep<TScope>,
    source: HistoryStep<TScope>,
    refusal: HistoryRefusal
  ): void {
    const stacks = this.#scopes.get(replayed.scope);
    const taken = stacks.take(replayed);
    if (taken !== null) {
      stacks.push(taken.side === "undo" ? "redo" : "undo", source);
      this.#refuse(source, refusal);
      this.#notify(replayed.scope);
    }
  }

  #takeOwner(
    change: AnyChange
  ): Owner<TScope> | undefined {
    const owner = this.#owners.get(change);
    this.#owners.delete(change);

    return owner;
  }

  #notify(
    scope: TScope
  ): void {
    this.emit(
      "change",
      scope,
      this.state(scope)
    );
  }
}
