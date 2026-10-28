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
  SceneAnchorJSON,
  SceneChange,
  SceneCommand
} from "@jolly-pixel/asset.scene/client";

// Import Internal Dependencies
import type { SceneEditing } from "../../editing/SceneEditing.ts";
import {
  ActorTreeRows,
  PREFAB_ICON
} from "./ActorTreeRows.ts";
import type { AddActorAction } from "./model/ActorPreset.ts";
import type { ActorPresetMenu } from "./model/ActorPresetMenu.ts";
import { TreeExpansion } from "./TreeExpansion.ts";

export interface HierarchyView {
  beginRename(id: string): void;
}

type AddAction = AddActorAction | "add-instance";
type RowAction = "rename" | "duplicate" | "delete" | AddAction;

export class HierarchyController {
  static #addEntries(
    presets: ActorPresetMenu
  ): MenuEntry<AddAction>[] {
    return [
      ...presets.entries,
      "separator",
      {
        id: "add-instance",
        label: "Scene instance…",
        icon: PREFAB_ICON
      }
    ];
  }

  static #rowEntries(
    presets: ActorPresetMenu,
    canAddChild: boolean
  ): MenuEntry<RowAction>[] {
    return [
      {
        id: "group:add-child",
        label: "Add child",
        icon: "plus",
        disabled: !canAddChild,
        items: HierarchyController.#addEntries(presets)
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
        icon: "trash",
        intent: "danger"
      }
    ];
  }

  static #placedActor(
    command: SceneCommand
  ): string | null {
    switch (command.action) {
      case "actor-added":
        return command.actors[0]?.id ?? null;
      case "actor-moved":
        return command.id;
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
        editing.presence.selections,
        editing.components,
        editing.anchors
      );
    }
    this.#host.requestUpdate();
  };

  #onChange = (
    change: SceneChange
  ): void => {
    this.#rebuild();
    const id = HierarchyController.#placedActor(change.command);
    if (id !== null) {
      this.#expansion.reveal(this.#rows.ancestorIds(id));
    }
  };

  #onSelection = (): void => {
    const editing = this.#connection.current;
    if (editing !== null) {
      for (const id of editing.selection.ids) {
        this.#expansion.reveal(this.#rows.ancestorIds(id));
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
      const {
        document,
        selection,
        presence,
        anchors
      } = editing;
      this.#rebuild();

      return [
        document.subscribe("change", this.#onChange),
        document.subscribe("reset", this.#rebuild),
        selection.subscribe("change", this.#onSelection),
        presence.subscribe("selectionsChange", this.#rebuild),
        anchors.subscribe("anchorsChange", this.#rebuild)
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
    return this.#expansion.expanded(this.#rows.ids());
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
    this.#connection.current?.selection.select(
      event.detail.selected.filter((id) => this.#rows.anchorRow(id) === null)
    );
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

  readonly acceptDrop = (
    detail: JollyReparentDetail
  ): boolean => this.#rows.accepts(detail);

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
    const editing = this.#connection.current;
    if (editing === null) {
      return MenuSession.EMPTY;
    }

    return MenuSession.from(
      HierarchyController.#addEntries(editing.presets),
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
    const row = this.#rows.anchorRow(id);
    if (row !== null) {
      return MenuSession.forRow(
        HierarchyController.#addEntries(editing.presets),
        () => editing.document.tree.has(row.ownerId),
        (action) => this.#add(action, row.ownerId, row.anchor)
      );
    }
    if (!editing.selection.has(id)) {
      editing.selection.select([id]);
    }

    return MenuSession.forRow(
      HierarchyController.#rowEntries(
        editing.presets,
        !editing.document.tree.isInstance(id)
      ),
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
    action: AddAction,
    parentId: string | null,
    anchor?: SceneAnchorJSON
  ): Promise<void> {
    const editing = this.#connection.current;
    if (editing === null) {
      return;
    }
    if (action === "add-instance") {
      await editing.actions.addInstance(parentId, anchor);

      return;
    }

    const preset = editing.presets.find(action);
    if (preset !== undefined) {
      await editing.actions.addActor(preset, parentId, anchor);
    }
  }
}
