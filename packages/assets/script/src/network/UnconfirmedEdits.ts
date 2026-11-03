// Import Third-party Dependencies
import type { CommandReconciler } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import { TextEdit } from "../text/TextEdit.ts";
import type { ScriptNetworkCommand } from "./types.ts";

interface InflightEdit {
  readonly command: ScriptNetworkCommand;
  edit: TextEdit;
}

export class UnconfirmedEdits implements CommandReconciler<ScriptNetworkCommand> {
  #inflight: InflightEdit | null = null;
  #held = TextEdit.empty;

  hold(
    edit: TextEdit
  ): void {
    this.#held = this.#held.then(edit);
  }

  flush(
    send: (edit: TextEdit) => ScriptNetworkCommand
  ): void {
    if (this.#inflight !== null || this.#held.empty) {
      return;
    }

    const edit = this.#held;
    this.#held = TextEdit.empty;
    this.#inflight = {
      command: send(edit),
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

  forget(): void {
    this.#inflight = null;
    this.#held = TextEdit.empty;
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
    const held = this.#held.rebaseOnto(earlier);
    this.#held = held.edit;

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
