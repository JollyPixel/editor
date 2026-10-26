// Import Internal Dependencies
import type {
  HistoryGuard,
  HistoryRegistration
} from "../registration/HistoryRegistration.ts";
import { PartBasis } from "./PartBasis.ts";

export type PartRegistration = Pick<
  HistoryRegistration<string, unknown, unknown, unknown, unknown>,
  "document" | "keys" | "compact"
>;

export class PartDraft {
  readonly basis = new PartBasis();

  #commands: unknown[] = [];

  prepend(
    inverse: readonly unknown[]
  ): void {
    this.#commands.unshift(...inverse);
  }

  file(
    registration: PartRegistration
  ): HistoryPart {
    return new HistoryPart(
      registration.compact?.(this.#commands) ?? this.#commands,
      this.basis,
      registration
    );
  }
}

export class HistoryPart {
  readonly basis: PartBasis;

  #commands: readonly unknown[];
  #registration: PartRegistration;
  #guard: HistoryGuard<unknown, unknown>;
  #captured: unknown;

  constructor(
    commands: readonly unknown[],
    basis: PartBasis,
    registration: PartRegistration
  ) {
    this.#commands = commands;
    this.basis = basis;
    this.#registration = registration;
    this.#guard = registration.keys.guard(commands);
    this.#captured = this.#guard.capture();
  }

  rebind(
    registration: PartRegistration
  ): void {
    this.#registration = registration;
    this.#guard = registration.keys.guard(this.#commands);
  }

  touches(
    written: unknown
  ): boolean {
    return this.#guard.touches(written);
  }

  recapture(): void {
    this.#captured = this.#guard.capture();
  }

  changed(): boolean {
    return !this.#guard.same(this.#captured);
  }

  replay(): boolean {
    const { document } = this.#registration;
    let applied = false;
    for (const command of this.#commands) {
      applied = document.applyStep(
        command,
        this.basis.version
      ) !== null || applied;
    }

    return applied;
  }
}
