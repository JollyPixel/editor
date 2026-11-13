// Import Third-party Dependencies
import type { CommandReconciler } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import { TextEdit } from "../model/TextEdit.ts";
import type {
  ScriptNetworkCommand,
  ScriptStep
} from "./types.ts";

interface InflightEdit {
  readonly command: ScriptNetworkCommand;
  edit: TextEdit;
}

interface HeldEdit {
  edit: TextEdit;
  readonly steps: ScriptStep[];
}

export type SendHeldEdit = (
  edit: TextEdit,
  steps: readonly ScriptStep[]
) => ScriptNetworkCommand;

function nothingHeld(): HeldEdit {
  return {
    edit: TextEdit.empty,
    steps: []
  };
}

export class UnconfirmedEdits implements CommandReconciler<ScriptNetworkCommand> {
  #inflight: InflightEdit | null = null;
  #held = nothingHeld();

  hold(
    edit: TextEdit,
    step: ScriptStep | null
  ): void {
    this.#held.edit = this.#held.edit.then(edit);
    if (step !== null) {
      this.#held.steps.push(step);
    }
  }

  flush(
    send: SendHeldEdit
  ): void {
    if (this.#inflight !== null || this.#held.edit.empty) {
      return;
    }

    const { edit, steps } = this.#held;
    this.#held = nothingHeld();
    this.#inflight = {
      command: send(edit, steps),
      edit
    };
  }

  confirm(
    command: ScriptNetworkCommand
  ): boolean {
    if (this.#inflight?.command !== command) {
      return false;
    }

    this.#inflight = null;

    return true;
  }

  forget(): ScriptStep[] {
    const { steps } = this.#held;
    this.#inflight = null;
    this.#held = nothingHeld();

    return steps;
  }

  rebase(
    remote: TextEdit
  ): TextEdit {
    let earlier = remote;
    if (this.#inflight !== null) {
      const rebased = this.#inflight.edit.rebaseOnto(earlier);
      this.#inflight.edit = rebased.edit;
      earlier = rebased.earlier;
    }
    const held = this.#held.edit.rebaseOnto(earlier);
    this.#held.edit = held.edit;

    return held.earlier;
  }

  keys(): null {
    return null;
  }

  narrow(): null {
    return null;
  }

  revert(): boolean {
    return true;
  }

  replay(
    command: ScriptNetworkCommand
  ): boolean {
    return this.#inflight?.command === command;
  }
}
