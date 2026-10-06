// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { CommandChange } from "../command/CommandDocument.ts";
import type {
  HistoryGuard,
  HistoryRegistration
} from "./HistoryRegistration.ts";

// CONSTANTS
const kDefaultLimit = 50;

export type HistoryRefusal =
  /** A peer changed a value the step would write back. */
  | { reason: "peer"; clientId: string | null; }
  /** The server refused the step's edit, or the undo or redo of it. */
  | { reason: "server"; }
  /** A document the step touched is not open in this history. */
  | { reason: "closed"; documentId: string; }
  /** The documents refused every command of the step. */
  | { reason: "gone"; };

export interface HistoryStepInfo {
  readonly label: string | null;
  readonly refused: HistoryRefusal;
}

export interface HistoryScopeState {
  /** Refused steps aside. */
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
  undoCount: number;
  redoCount: number;
  /** Refused steps of both stacks, newest first. */
  refused: HistoryStepInfo[];
}

export type CommandHistoryEvents<TScope extends string> = {
  change: (scope: TScope, state: HistoryScopeState) => void;
  refused: (scope: TScope, step: HistoryStepInfo) => void;
  /** An undo or redo passed over a refused step. */
  skipped: (scope: TScope, step: HistoryStepInfo) => void;
};

export interface CommandHistoryOptions<TScope extends string> {
  scopes: readonly TScope[];
  /** Steps kept per stack, the oldest dropped first; 50 by default. */
  limit?: number;
}

type AnyRegistration<TScope extends string> = HistoryRegistration<TScope, unknown, unknown>;
type AnyChange = CommandChange<unknown, unknown>;

interface Part {
  readonly documentId: string;
  readonly commands: unknown[];
  guarded: Map<string, string | undefined>;
  pending: number;
  basis: number | undefined;
}

interface Step<TScope extends string> {
  label: string | null;
  readonly scope: TScope;
  readonly parts: Map<string, Part>;
  refused: HistoryRefusal | null;
  readonly source: Step<TScope> | null;
}

interface RefusedStep<TScope extends string> extends Step<TScope> {
  refused: HistoryRefusal;
}

interface Stacks<TScope extends string> {
  undo: Step<TScope>[];
  redo: Step<TScope>[];
}

interface Recording<TScope extends string> {
  readonly step: Step<TScope>;
  readonly target: "undo" | "redo" | null;
}

export class CommandHistory<TScope extends string> extends Emitter<CommandHistoryEvents<TScope>> {
  readonly limit: number;

  #stacks = new Map<TScope, Stacks<TScope>>();
  #documents = new Map<string, AnyRegistration<TScope>>();
  #releases = new Map<string, () => void>();
  #recording: Recording<TScope> | null = null;
  #owners = new WeakMap<object, { step: Step<TScope>; part: Part; }>();

  constructor(
    options: CommandHistoryOptions<TScope>
  ) {
    super();

    const { limit = kDefaultLimit } = options;
    if (!Number.isInteger(limit) || limit < 1) {
      throw new RangeError(`CommandHistory: limit must be a positive integer, got ${limit}.`);
    }
    this.limit = limit;
    for (const scope of options.scopes) {
      this.#stacks.set(scope, { undo: [], redo: [] });
    }
  }

  register<TCommand, TImage>(
    registration: HistoryRegistration<TScope, TCommand, TImage>
  ): () => void {
    const { id } = registration;
    if (this.#documents.has(id)) {
      throw new Error(`CommandHistory: a document "${id}" is already registered.`);
    }

    const registered: AnyRegistration<TScope> = registration;
    const onConfirmed = (change: AnyChange, version: number): void => this.#onConfirmed(change, version);
    const onRefused = (change: AnyChange): void => this.#onRefused(change);
    const { receipts } = registered.document;
    receipts.on("confirmed", onConfirmed);
    receipts.on("refused", onRefused);
    const releases = [
      registered.document.subscribe("change", (change) => this.#onChange(registered, change)),
      registered.document.subscribe("reset", () => this.#onReset(id)),
      () => receipts.off("confirmed", onConfirmed),
      () => receipts.off("refused", onRefused)
    ];
    this.#documents.set(id, registered);
    this.#releases.set(id, () => {
      for (const release of releases) {
        release();
      }
    });

    return () => this.#unregister(id);
  }

  record<T>(
    scope: TScope,
    label: string | null,
    edit: () => T
  ): T {
    return this.#within({ step: newStep(scope, label, null), target: null }, edit);
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
    const { undo, redo } = this.#stacksOf(scope);
    const undoable = undo.filter(({ refused }) => refused === null);
    const redoable = redo.filter(({ refused }) => refused === null);

    return {
      canUndo: undoable.length > 0,
      canRedo: redoable.length > 0,
      undoLabel: undoable.at(-1)?.label ?? null,
      redoLabel: redoable.at(-1)?.label ?? null,
      undoCount: undoable.length,
      redoCount: redoable.length,
      refused: [...undo, ...redo]
        .filter(isRefused)
        .reverse()
        .map(infoOf)
    };
  }

  dispose(): void {
    for (const id of [...this.#releases.keys()]) {
      this.#unregister(id);
    }
    for (const stacks of this.#stacks.values()) {
      stacks.undo = [];
      stacks.redo = [];
    }
    this.#recording = null;
    this.removeAllListeners();
  }

  #unregister(
    id: string
  ): void {
    this.#releases.get(id)?.();
    this.#releases.delete(id);
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
    const recording = this.#recording ?? newRecording(registration.scopeOf(change));
    if (recording !== null) {
      this.#within(recording, (step) => this.#collect(step, registration, change));
    }
  }

  #within<T>(
    recording: Recording<TScope>,
    edit: (step: Step<TScope>) => T
  ): T {
    if (this.#recording !== null) {
      return edit(this.#recording.step);
    }

    this.#recording = recording;
    try {
      return edit(recording.step);
    }
    finally {
      this.#recording = null;
      this.#file(recording);
    }
  }

  #collect(
    step: Step<TScope>,
    registration: AnyRegistration<TScope>,
    change: AnyChange
  ): void {
    const { id, document } = registration;
    step.label ??= registration.label?.(change) ?? null;
    let part = step.parts.get(id);
    if (part === undefined) {
      part = {
        documentId: id,
        commands: [],
        guarded: new Map(),
        pending: 0,
        basis: undefined
      };
      step.parts.set(id, part);
    }

    part.commands.unshift(...change.inverse);
    if (document.receipts.attached) {
      part.pending++;
      this.#owners.set(change, { step, part });
    }
  }

  #file(
    recording: Recording<TScope>
  ): void {
    const { step, target } = recording;
    for (const part of step.parts.values()) {
      if (part.commands.length === 0) {
        step.parts.delete(part.documentId);
      }
      else {
        part.guarded = new Map(this.#guardsOf(part).map(({ key, read }) => [key, asJSON(read())]));
      }
    }
    if (step.parts.size === 0) {
      return;
    }

    const stacks = this.#stacksOf(step.scope);
    if (target === null) {
      stacks.redo = [];
    }
    this.#push(stacks[target ?? "undo"], step);
    this.#notify(step.scope);
  }

  #guardsOf(
    part: Part
  ): readonly HistoryGuard[] {
    return this.#documents.get(part.documentId)?.keys.guards(part.commands) ?? [];
  }

  #settle(
    registration: AnyRegistration<TScope>,
    change: AnyChange
  ): void {
    const keys = new Set(registration.keys.written(change));
    for (const { undo, redo } of this.#stacks.values()) {
      for (const step of [...undo, ...redo]) {
        const part = step.parts.get(registration.id);
        if (part === undefined || !hasAny(part.guarded, keys)) {
          continue;
        }

        for (const { key, read } of this.#guardsOf(part)) {
          if (keys.has(key) && part.guarded.has(key)) {
            part.guarded.set(key, asJSON(read()));
          }
        }
      }
    }
  }

  #push(
    stack: Step<TScope>[],
    step: Step<TScope>
  ): void {
    stack.push(step);
    if (stack.length > this.limit) {
      stack.shift();
    }
  }

  #step(
    scope: TScope,
    from: "undo" | "redo"
  ): boolean {
    if (this.#recording !== null) {
      return false;
    }

    const stacks = this.#stacksOf(scope);
    for (let index = stacks[from].length - 1; index >= 0; index--) {
      const step = stacks[from][index];
      if (isRefused(step)) {
        this.emit("skipped", scope, infoOf(step));
        continue;
      }

      const closed = [...step.parts.keys()].find((id) => !this.#documents.has(id));
      if (closed !== undefined) {
        this.emit("skipped", scope, this.#refuse(step, { reason: "closed", documentId: closed }));
        continue;
      }

      stacks[from].splice(index, 1);
      if (this.#replay(step, from === "undo" ? "redo" : "undo")) {
        this.#notify(scope);

        return true;
      }

      stacks[from].splice(index, 0, step);
      this.emit("skipped", scope, this.#refuse(step, { reason: "gone" }));
    }
    this.#notify(scope);

    return false;
  }

  #replay(
    step: Step<TScope>,
    target: "undo" | "redo"
  ): boolean {
    return this.#within({ step: newStep(step.scope, step.label, step), target }, () => {
      let applied = false;
      for (const part of [...step.parts.values()].reverse()) {
        const document = this.#documents.get(part.documentId)?.document;
        if (document === undefined) {
          continue;
        }
        for (const command of part.commands) {
          applied = document.applyStep(command, part.basis) !== null || applied;
        }
      }

      return applied;
    });
  }

  #onPeerChange(
    registration: AnyRegistration<TScope>,
    change: AnyChange
  ): void {
    const keys = new Set(registration.keys.written(change));
    this.#refuseWhere(
      registration.id,
      (part) => hasAny(part.guarded, keys),
      { reason: "peer", clientId: change.clientId }
    );
  }

  #onReset(
    documentId: string
  ): void {
    this.#refuseWhere(
      documentId,
      (part) => this.#guardsOf(part).some(({ key, read }) => (
        part.guarded.has(key) && asJSON(read()) !== part.guarded.get(key)
      )),
      { reason: "peer", clientId: null }
    );
  }

  #refuseWhere(
    documentId: string,
    matches: (part: Part) => boolean,
    refusal: HistoryRefusal
  ): void {
    for (const [scope, { undo, redo }] of this.#stacks) {
      let changed = false;
      for (const step of [...undo, ...redo]) {
        const part = step.parts.get(documentId);
        if (step.refused === null && part !== undefined && part.pending === 0 && matches(part)) {
          this.#refuse(step, refusal);
          changed = true;
        }
      }
      if (changed) {
        this.#notify(scope);
      }
    }
  }

  #refuse(
    step: Step<TScope>,
    refusal: HistoryRefusal
  ): HistoryStepInfo {
    step.refused = refusal;
    const info = {
      label: step.label,
      refused: refusal
    };
    this.emit("refused", step.scope, info);

    return info;
  }

  #onConfirmed(
    change: AnyChange,
    version: number
  ): void {
    const owner = this.#owners.get(change);
    if (owner !== undefined) {
      this.#owners.delete(change);
      owner.part.pending--;
      owner.part.basis = Math.max(owner.part.basis ?? version, version);
    }
  }

  #onRefused(
    change: AnyChange
  ): void {
    const owner = this.#owners.get(change);
    if (owner === undefined) {
      return;
    }

    this.#owners.delete(change);
    owner.part.pending--;
    const { step } = owner;
    if (step.source === null) {
      this.#refuseRecorded(step);
    }
    else {
      this.#restoreReplayed(step, step.source);
    }
  }

  #refuseRecorded(
    step: Step<TScope>
  ): void {
    if (step.refused === null) {
      this.#refuse(step, { reason: "server" });
      this.#notify(step.scope);
    }
  }

  #restoreReplayed(
    replayed: Step<TScope>,
    source: Step<TScope>
  ): void {
    const stacks = this.#stacksOf(replayed.scope);
    for (const stack of [stacks.undo, stacks.redo]) {
      const index = stack.indexOf(replayed);
      if (index !== -1) {
        stack.splice(index, 1);
        this.#push(stack === stacks.undo ? stacks.redo : stacks.undo, source);
        this.#refuse(source, { reason: "server" });
        this.#notify(replayed.scope);

        return;
      }
    }
  }

  #stacksOf(
    scope: TScope
  ): Stacks<TScope> {
    const stacks = this.#stacks.get(scope);
    if (stacks === undefined) {
      throw new Error(`CommandHistory: unknown scope "${scope}".`);
    }

    return stacks;
  }

  #notify(
    scope: TScope
  ): void {
    this.emit("change", scope, this.state(scope));
  }
}

function newStep<TScope extends string>(
  scope: TScope,
  label: string | null,
  source: Step<TScope> | null
): Step<TScope> {
  return {
    label,
    scope,
    parts: new Map(),
    refused: null,
    source
  };
}

function newRecording<TScope extends string>(
  scope: TScope | null
): Recording<TScope> | null {
  return scope === null ? null : { step: newStep(scope, null, null), target: null };
}

function isRefused<TScope extends string>(
  step: Step<TScope>
): step is RefusedStep<TScope> {
  return step.refused !== null;
}

function infoOf<TScope extends string>(
  step: RefusedStep<TScope>
): HistoryStepInfo {
  return {
    label: step.label,
    refused: step.refused
  };
}

function hasAny(
  guarded: ReadonlyMap<string, unknown>,
  keys: ReadonlySet<string>
): boolean {
  for (const key of guarded.keys()) {
    if (keys.has(key)) {
      return true;
    }
  }

  return false;
}

function asJSON(
  value: unknown
): string | undefined {
  return value === undefined ? undefined : JSON.stringify(value);
}
