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
import type { TreeRowView } from "./TreeRowView.ts";
import { originatesInButton } from "../../dom.ts";

export type TreeClickedRow = Pick<
  TreeRowView,
  "id" | "selectable" | "branch" | "expanded"
>;

export interface TreeSelectionOptions<TData> {
  visibleRows(): readonly FlatTreeRow<TData>[];
  selected(): string[];
  multiple(): boolean;
  requireSelection(): boolean;
  interaction(): TreeInteraction;
  switchInteraction(next: TreeInteraction): void;
}

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
    row: TreeClickedRow
  ): void {
    if (this.#consumeSuppressedClick()) {
      return;
    }

    if (originatesInButton(event.target)) {
      return;
    }

    if (!row.selectable) {
      if (row.branch) {
        emitDataEvent(this.#host, "jolly-toggle-expand", {
          id: row.id,
          expanded: !row.expanded
        });
      }

      return;
    }

    const result = resolveSelection({
      rows: this.#options.visibleRows(),
      clickedId: row.id,
      current: this.#options.selected(),
      anchorId: this.#anchorId,
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey || event.metaKey,
      multiple: this.#options.multiple(),
      requireSelection: this.#options.requireSelection()
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
      this.#options.requireSelection() ||
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
      this.#options.switchInteraction(idleTreeInteraction());

      return true;
    }

    return false;
  }
}
