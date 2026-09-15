// Import Internal Dependencies
import {
  resolveSelection,
  type FlatTreeRow
} from "./model.ts";
import {
  idleTreeInteraction,
  type TreeInteraction
} from "./interaction.ts";
import { emitDataEvent } from "./contract.ts";
import { originatesInButton } from "../../dom.ts";

export interface TreeSelectionOptions<TData> {
  visibleRows(): readonly FlatTreeRow<TData>[];
  selected(): string[];
  multiple(): boolean;
  interaction(): TreeInteraction;
  setInteraction(next: TreeInteraction): void;
}

/**
 * Owns click, ctrl/shift, and keyboard row selection for jolly-tree.
 */
export class TreeSelectionController<TData> {
  #host: EventTarget;
  #options: TreeSelectionOptions<TData>;
  #anchorId: string | null = null;

  constructor(
    host: EventTarget,
    options: TreeSelectionOptions<TData>
  ) {
    this.#host = host;
    this.#options = options;
  }

  onRowClick(
    event: MouseEvent,
    id: string
  ): void {
    if (this.#consumeSuppressedClick()) {
      return;
    }

    if (originatesInButton(event.target)) {
      return;
    }

    const result = resolveSelection({
      rows: this.#options.visibleRows(),
      clickedId: id,
      current: this.#options.selected(),
      anchorId: this.#anchorId,
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey || event.metaKey,
      multiple: this.#options.multiple()
    });
    this.#anchorId = result.anchorId;
    emitDataEvent(this.#host, "jolly-select", { selected: result.selected });
  }

  onRowsClick(
    event: MouseEvent
  ): void {
    if (
      event.target !== event.currentTarget ||
      this.#consumeSuppressedClick() ||
      this.#options.selected().length === 0
    ) {
      return;
    }

    this.#anchorId = null;
    emitDataEvent(this.#host, "jolly-select", { selected: [] });
  }

  selectSingle(
    id: string
  ): void {
    this.#anchorId = id;
    emitDataEvent(this.#host, "jolly-select", { selected: [id] });
  }

  #consumeSuppressedClick(): boolean {
    const interaction = this.#options.interaction();
    if (interaction.kind === "idle" && interaction.suppressClick) {
      this.#options.setInteraction(idleTreeInteraction());

      return true;
    }

    return false;
  }
}
