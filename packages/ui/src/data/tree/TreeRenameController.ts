// Import Internal Dependencies
import { resolveRename } from "./model.ts";
import {
  idleTreeInteraction,
  type TreeInteraction
} from "./interaction.ts";
import {
  emitDataEvent,
  type TreeRenameValidator
} from "./contract.ts";
import type { TreeRowView } from "./TreeRowView.ts";
import { isInputElement } from "../../dom.ts";

export interface TreeRenameOptions {
  validateRename(): TreeRenameValidator | null;
  interaction(): TreeInteraction;
  setInteraction(next: TreeInteraction): void;
  focusRow(id: string): void;
}

export class TreeRenameController {
  #host: EventTarget;
  #options: TreeRenameOptions;

  constructor(
    host: EventTarget,
    options: TreeRenameOptions
  ) {
    this.#host = host;
    this.#options = options;
  }

  readonly onFocus = (
    event: FocusEvent
  ): void => {
    if (isInputElement(event.target)) {
      event.target.select();
    }
  };

  onInput(
    event: InputEvent,
    view: TreeRowView
  ): void {
    this.#validate(event.target, view);
  }

  onKeyDown(
    event: KeyboardEvent,
    view: TreeRowView
  ): void {
    // The tree's own navigation must not read the keys typed into the field.
    event.stopPropagation();

    if (event.key === "Escape") {
      event.preventDefault();
      this.#cancel();
    }
    else if (event.key === "Enter") {
      event.preventDefault();
      if (this.#validate(event.target, view) && isInputElement(event.target)) {
        // Blur commits, so the two paths cannot double-emit.
        event.target.blur();
      }
    }
  }

  onBlur(
    event: FocusEvent,
    view: TreeRowView
  ): void {
    const interaction = this.#options.interaction();
    if (interaction.kind !== "renaming" || interaction.id !== view.id) {
      return;
    }

    this.#options.setInteraction(idleTreeInteraction());
    const name = draftOf(event.target, view);
    if (name !== null && interaction.error === null) {
      emitDataEvent(this.#host, "jolly-rename", { id: view.id, name });
    }
    this.#options.focusRow(view.id);
  }

  #validate(
    target: EventTarget | null,
    view: TreeRowView
  ): boolean {
    const interaction = this.#options.interaction();
    if (interaction.kind !== "renaming") {
      return false;
    }

    const name = draftOf(target, view);
    const validator = this.#options.validateRename();
    const error = name === null || validator === null ?
      null :
      validator({ id: view.id, name });
    this.#options.setInteraction({
      ...interaction,
      error
    });

    return error === null;
  }

  #cancel(): void {
    const interaction = this.#options.interaction();
    this.#options.setInteraction(idleTreeInteraction());
    if (interaction.kind === "renaming") {
      this.#options.focusRow(interaction.id);
    }
  }
}

function draftOf(
  target: EventTarget | null,
  view: TreeRowView
): string | null {
  return resolveRename(
    view.label,
    isInputElement(target) ? target.value : ""
  );
}
