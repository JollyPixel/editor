// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";
import {
  MenuSession,
  SubscriptionController,
  type JollyRenameDetail,
  type JollyReparentDetail,
  type JollySelectDetail,
  type JollyToggleExpandDetail,
  type JollyToggleVisibleDetail,
  type MenuEntry,
  type TreeNode
} from "@jolly-pixel/ui";
import type {
  SceneChange,
  SceneCommand
} from "@jolly-pixel/asset.scene/client";

// Import Internal Dependencies
import type { SceneEditing } from "../../editing/SceneEditing.ts";
import { ActorTreeRows } from "./ActorTreeRows.ts";
import type { AddActorAction } from "./model/ActorPreset.ts";
import { ACTOR_PRESET_MENU } from "./model/actorPresets.ts";
import { TreeExpansion } from "./TreeExpansion.ts";

export interface HierarchyView {
  beginRename(id: string): void;
}

type RowAction = "rename" | "duplicate" | "delete" | AddActorAction;

// CONSTANTS
const kRowEntries: readonly MenuEntry<RowAction>[] = [
  {
    id: "group:add-child",
    label: "Add child",
    icon: "plus",
    items: ACTOR_PRESET_MENU.entries
  },
  "separator",
  {
    id: "rename",
    label: "Rename",
    icon: "action-rename"
  },
  {
    id: "duplicate",
    label: "Duplicate",
    icon: "action-duplicate"
  },
  "separator",
  {
    id: "delete",
    label: "Delete",
    icon: "action-delete",
    intent: "danger"
  }
];

export class HierarchyController {
  static #destinationParent(
    command: SceneCommand
  ): string | null {
    switch (command.action) {
      case "actor-added":
        return command.actors[0]?.parentId ?? null;
      case "actor-moved":
        return command.parentId;
      default:
        return null;
    }
  }

  #host: ReactiveControllerHost;
  #view: HierarchyView;
  #connection: SubscriptionController<SceneEditing>;
  #rows = ActorTreeRows.EMPTY;
  #expansion = new TreeExpansion();

  #rebuild = (): void => {
    const editing = this.#connection.current;
    if (editing !== null) {
      this.#rows = ActorTreeRows.read(
        editing.document.tree,
        editing.presence.selections
      );
    }
    this.#host.requestUpdate();
  };

  #onChange = (
    change: SceneChange
  ): void => {
    const parentId = HierarchyController.#destinationParent(change.command);
    if (parentId !== null) {
      this.#expansion.expand(parentId);
    }
    this.#rebuild();
  };

  #onSelection = (): void => {
    const editing = this.#connection.current;
    if (editing !== null) {
      for (const id of editing.selection.ids) {
        this.#expansion.reveal(editing.document.tree.ancestorIds(id));
      }
    }
    this.#host.requestUpdate();
  };

  constructor(
    host: ReactiveControllerHost,
    view: HierarchyView
  ) {
    this.#host = host;
    this.#view = view;
    this.#connection = new SubscriptionController(host, (editing) => {
      const { document, selection, presence } = editing;
      this.#rebuild();

      return [
        document.subscribe("change", this.#onChange),
        document.subscribe("reset", this.#rebuild),
        selection.subscribe("change", this.#onSelection),
        presence.subscribe("selectionsChange", this.#rebuild)
      ];
    });
  }

  get nodes(): TreeNode[] {
    return this.#rows.roots;
  }

  get selected(): string[] {
    return [...this.#connection.current?.selection.ids ?? []];
  }

  get expanded(): string[] {
    return this.#expansion.expanded(
      this.#connection.current?.document.tree.actorIds() ?? []
    );
  }

  get hasSelection(): boolean {
    return (this.#connection.current?.selection.primary ?? null) !== null;
  }

  attach(
    editing: SceneEditing
  ): void {
    this.#expansion.clear();
    this.#connection.attach(editing);
  }

  readonly handleSelect = (
    event: CustomEvent<JollySelectDetail>
  ): void => {
    this.#connection.current?.selection.select(event.detail.selected);
  };

  readonly handleToggleExpand = (
    event: CustomEvent<JollyToggleExpandDetail>
  ): void => {
    const { id, expanded } = event.detail;
    if (expanded) {
      this.#expansion.expand(id);
    }
    else {
      this.#expansion.collapse(id);
    }
    this.#host.requestUpdate();
  };

  readonly handleRename = (
    event: CustomEvent<JollyRenameDetail>
  ): void => {
    this.#connection.current?.document.rename(
      event.detail.id,
      event.detail.name
    );
  };

  readonly handleToggleVisible = (
    event: CustomEvent<JollyToggleVisibleDetail>
  ): void => {
    this.#connection.current?.document.changeVisibility(
      event.detail.id,
      event.detail.visible
    );
  };

  readonly handleReparent = (
    event: CustomEvent<JollyReparentDetail>
  ): void => {
    const moves = this.#rows.moves(event.detail);
    if (moves.length > 0) {
      this.#connection.current?.actions.move(moves);
    }
  };

  readonly duplicateSelected = (): void => {
    this.#connection.current?.actions.duplicateSelection();
  };

  readonly deleteSelected = (): void => {
    this.#connection.current?.actions.removeSelection();
  };

  addMenu(): MenuSession {
    if (this.#connection.current === null) {
      return MenuSession.EMPTY;
    }

    return MenuSession.from(
      ACTOR_PRESET_MENU.entries,
      (action) => this.#add(action, null)
    );
  }

  openMenu(
    id: string | null
  ): MenuSession {
    const editing = this.#connection.current;
    if (id === null || editing === null) {
      return this.addMenu();
    }
    if (!editing.selection.has(id)) {
      editing.selection.select([id]);
    }

    return MenuSession.forRow(
      kRowEntries,
      () => editing.document.tree.has(id),
      (action) => this.#runRow(action, id)
    );
  }

  async #runRow(
    action: RowAction,
    id: string
  ): Promise<void> {
    switch (action) {
      case "rename":
        this.#view.beginRename(id);
        break;
      case "duplicate":
        this.duplicateSelected();
        break;
      case "delete":
        this.deleteSelected();
        break;
      default:
        await this.#add(action, id);
    }
  }

  async #add(
    action: AddActorAction,
    parentId: string | null
  ): Promise<void> {
    const preset = ACTOR_PRESET_MENU.find(action);
    if (preset !== undefined) {
      await this.#connection.current?.actions.addActor(preset, parentId);
    }
  }
}
