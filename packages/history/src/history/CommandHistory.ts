// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { CommandChange } from "../document/CommandChange.ts";
import type { HistoryRegistration } from "../registration/HistoryRegistration.ts";
import {
  EMPTY_HISTORY_STATE,
  type HistoryRefusal,
  type HistoryScopeState,
  type HistoryStepInfo
} from "./HistoryState.ts";
import { HistoryStep } from "./HistoryStep.ts";
import type { PartBasis } from "./PartBasis.ts";
import {
  ScopeStacks,
  type StackSide
} from "./ScopeStacks.ts";

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

export interface CommandHistoryOptions {
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
> {
  #events = new Emitter<CommandHistoryEvents<TScope>>();
  #limit: number;
  #scopes = new Map<TScope, ScopeStacks<TScope>>();
  #documents = new Map<string, RegisteredDocument<TScope>>();
  #recording: HistoryStep<TScope> | null = null;
  #owners = new WeakMap<object, Owner<TScope>>();

  constructor(
    options: CommandHistoryOptions = {}
  ) {
    const limit = options.limit ?? kDefaultLimit;
    if (!Number.isInteger(limit) || limit < 1) {
      throw new RangeError(`CommandHistory: limit must be a positive integer, got ${limit}.`);
    }
    this.#limit = limit;
  }

  get limit(): number {
    return this.#limit;
  }

  on<TEvent extends keyof CommandHistoryEvents<TScope>>(
    event: TEvent,
    listener: CommandHistoryEvents<TScope>[TEvent]
  ): this {
    this.#events.on(event, listener);

    return this;
  }

  off<TEvent extends keyof CommandHistoryEvents<TScope>>(
    event: TEvent,
    listener: CommandHistoryEvents<TScope>[TEvent]
  ): this {
    this.#events.off(event, listener);

    return this;
  }

  subscribe<TEvent extends keyof CommandHistoryEvents<TScope>>(
    event: TEvent,
    listener: CommandHistoryEvents<TScope>[TEvent]
  ): () => void {
    return this.#events.subscribe(event, listener);
  }

  register<TCommand, TImage, TWritten, TCapture>(
    registration: HistoryRegistration<TScope, TCommand, TImage, TWritten, TCapture>
  ): () => void {
    const { id } = registration;
    if (this.#documents.has(id)) {
      throw new Error(`CommandHistory: a document "${id}" is already registered.`);
    }

    const registered: AnyRegistration<TScope> = registration;
    const { document } = registered;
    const releases = [
      document.subscribe(
        "change",
        (change) => this.#onChange(registered, change)
      ),
      document.subscribe("reset", (cause) => {
        if (cause === "load") {
          this.#onReset(registered);
        }
      }),
      document.receipts.subscribe(
        "confirmed",
        (change, version) => this.#onConfirmed(change, version)
      ),
      document.receipts.subscribe(
        "refused",
        (change) => this.#onRefused(change)
      )
    ];
    this.#documents.set(id, {
      registration: registered,
      release: () => {
        for (const release of releases) {
          release();
        }
      }
    });
    for (const step of this.#steps()) {
      step.rebind(id, registered);
    }

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
    if (this.#recording !== null) {
      return kJoinedStep;
    }

    const stacks = this.#ensureScope(scope);
    const step = new HistoryStep(scope, label);
    this.#recording = step;
    const close = (file: boolean): void => {
      if (this.#recording !== step) {
        return;
      }

      this.#recording = null;
      if (file && this.#file(step, stacks)) {
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
    return this.#scopes.get(
      scope
    )?.state ?? EMPTY_HISTORY_STATE;
  }

  removeScope(
    scope: TScope
  ): void {
    const stacks = this.#scopes.get(scope);
    if (stacks === undefined) {
      return;
    }

    this.#scopes.delete(scope);
    for (const step of stacks) {
      step.discard();
    }
    this.#events.emit("change", scope, EMPTY_HISTORY_STATE);
  }

  dispose(): void {
    for (const id of [...this.#documents.keys()]) {
      this.#unregister(id);
    }
    this.#scopes.clear();
    this.#recording = null;
    this.#events.removeAllListeners();
  }

  #ensureScope(
    scope: TScope
  ): ScopeStacks<TScope> {
    let stacks = this.#scopes.get(scope);
    if (stacks === undefined) {
      stacks = new ScopeStacks(this.#limit);
      this.#scopes.set(scope, stacks);
    }

    return stacks;
  }

  * #steps(): IterableIterator<HistoryStep<TScope>> {
    for (const stacks of this.#scopes.values()) {
      yield* stacks;
    }
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
        this.#recapture(registration, change);
        this.#onLocalChange(registration, change);
        break;
      case "remote":
        this.#onPeerChange(registration, change);
        break;
      case "replay":
        this.#recapture(registration, change);
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

    const scope = registration.resolveScope(change);
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

    const basis = step.collect(
      registration.id,
      change.inverse,
      () => registration.label?.(change) ?? null
    );
    if (registration.document.receipts.attached) {
      basis.expect(change);
      this.#owners.set(change, {
        step,
        basis
      });
    }
  }

  #file(
    step: HistoryStep<TScope>,
    stacks: ScopeStacks<TScope>
  ): boolean {
    if (this.#scopes.get(step.scope) !== stacks) {
      step.discard();

      return false;
    }

    step.file(
      (documentId) => this.#documents.get(documentId)?.registration
    );

    return !step.empty;
  }

  #recapture(
    registration: AnyRegistration<TScope>,
    change: AnyChange
  ): void {
    const written = registration.keys.written(change);
    for (const step of this.#steps()) {
      step.recapture(registration.id, written);
    }
  }

  #step(
    scope: TScope,
    from: StackSide
  ): boolean {
    const stacks = this.#scopes.get(scope);
    if (stacks === undefined || this.#recording !== null) {
      return false;
    }

    for (const step of stacks.newestFirst(from)) {
      const blocked = step.info ?? this.#blocker(step);
      if (
        blocked === null &&
        stacks.cross(step, (file) => this.#replay(step, stacks, file))
      ) {
        this.#notify(scope);

        return true;
      }
      this.#events.emit(
        "skipped",
        scope,
        blocked ?? this.#refuse(step, { reason: "gone" })
      );
    }
    this.#notify(scope);

    return false;
  }

  #blocker(
    step: HistoryStep<TScope>
  ): HistoryStepInfo | null {
    const refusal = step.blocker(
      (documentId) => this.#documents.has(documentId)
    );

    return refusal === null ? null : this.#refuse(step, refusal);
  }

  #replay(
    step: HistoryStep<TScope>,
    stacks: ScopeStacks<TScope>,
    file: (replayed: HistoryStep<TScope>) => void
  ): boolean {
    const replayed = new HistoryStep(step.scope, step.label, step);
    this.#recording = replayed;
    try {
      return step.replay();
    }
    finally {
      this.#recording = null;
      if (this.#file(replayed, stacks)) {
        file(replayed);
      }
    }
  }

  #onPeerChange(
    registration: AnyRegistration<TScope>,
    change: AnyChange
  ): void {
    const written = registration.keys.written(change);
    this.#refuseWhere(
      (step) => step.overwrittenBy(registration.id, written),
      {
        reason: "peer",
        clientId: change.clientId
      }
    );
  }

  #onReset(
    registration: AnyRegistration<TScope>
  ): void {
    this.#refuseWhere(
      (step) => step.changedIn(registration.id),
      { reason: "changed" }
    );
  }

  #refuseWhere(
    matches: (step: HistoryStep<TScope>) => boolean,
    refusal: HistoryRefusal
  ): void {
    const changed = new Set<TScope>();
    for (const step of this.#steps()) {
      if (!step.refused && matches(step)) {
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
    this.#events.emit("refused", step.scope, info);

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

  #reject(
    step: HistoryStep<TScope>,
    refusal: HistoryRefusal
  ): void {
    if (step.source !== null) {
      this.#restore(step, step.source, refusal);
    }
    else if (!step.refused) {
      this.#refuse(step, refusal);
      this.#notify(step.scope);
    }
  }

  #restore(
    replayed: HistoryStep<TScope>,
    source: HistoryStep<TScope>,
    refusal: HistoryRefusal
  ): void {
    const stacks = this.#scopes.get(replayed.scope);
    if (stacks?.restore(replayed, source) === true) {
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
    const stacks = this.#scopes.get(scope);
    if (stacks !== undefined) {
      this.#events.emit("change", scope, stacks.state);
    }
  }
}
