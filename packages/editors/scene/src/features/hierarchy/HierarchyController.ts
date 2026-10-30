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
  type MenuItem,
  type TreeNode
} from "@jolly-pixel/ui";
import type {
  SceneAnchorJSON,
  SceneChange,
  SceneCommand
} from "@jolly-pixel/asset.scene/client";

// Import Internal Dependencies
import type { ActorRole } from "../../editing/InstanceOverrides.ts";
import type { SceneEditing } from "../../editing/SceneEditing.ts";
import {
  ActorTreeRows,
  PREFAB_ICON
} from "./ActorTreeRows.ts";
import type { AddActorAction } from "./model/ActorPreset.ts";
import type { ActorPresetMenu } from "./model/ActorPresetMenu.ts";
import { TreeExpansion } from "./TreeExpansion.ts";

// CONSTANTS
const kOverrideItems = {
  "revert-overrides": {
    id: "revert-overrides",
    label: "Revert overrides",
    icon: "revert"
  },
  "apply-to-prefab": {
    id: "apply-to-prefab",
    label: "Apply overrides to prefab",
    icon: "asset-export"
  }
} satisfies { [TAction in OverrideAction]: MenuItem<TAction>; };
const kOverrideActions: Readonly<Record<ActorRole, readonly OverrideAction[]>> = {
  own: [],
  instance: ["revert-overrides", "apply-to-prefab"],
  inner: ["revert-overrides"]
};

export interface HierarchyView {
  beginRename(id: string): void;
}

type AddAction = AddActorAction | "add-instance";
type OverrideAction = "revert-overrides" | "apply-to-prefab";
type RowAction = "rename" | "duplicate" | "delete" | OverrideAction | AddAction;

export class HierarchyController {
  static #overrideEntries(
    role: ActorRole,
    overridden: boolean
  ): MenuEntry<OverrideAction>[] {
    return kOverrideActions[role].map((action) => {
      return {
        ...kOverrideItems[action],
        disabled: !overridden
      };
    });
  }

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
    editing: SceneEditing,
    id: string,
    role: ActorRole
  ): MenuEntry<RowAction>[] {
    const rename: MenuItem<RowAction> = {
      id: "rename",
      label: "Rename",
      icon: "action-rename"
    };
    const overrides = HierarchyController.#overrideEntries(
      role,
      editing.overrides.actorOverridden(id)
    );
    if (role === "inner") {
      return [rename, "separator", ...overrides];
    }

    return [
      {
        id: "group:add-child",
        label: "Add child",
        icon: "plus",
        disabled: !editing.document.tree.canContain(id),
        items: HierarchyController.#addEntries(editing.presets)
      },
      "separator",
      rename,
      {
        id: "duplicate",
        label: "Duplicate",
        icon: "action-duplicate"
      },
      ...overrides.length === 0 ? [] : ["separator" as const, ...overrides],
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
        editing.live
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
        live
      } = editing;
      this.#rebuild();

      return [
        document.subscribe("change", this.#onChange),
        document.subscribe("reset", this.#rebuild),
        selection.subscribe("change", this.#onSelection),
        presence.subscribe("selectionsChange", this.#rebuild),
        live.subscribe("anchorsChange", this.#rebuild),
        live.subscribe("actorsChange", this.#rebuild)
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
    this.#connection.current?.writes.rename(
      event.detail.id,
      event.detail.name
    );
  };

  readonly handleToggleVisible = (
    event: CustomEvent<JollyToggleVisibleDetail>
  ): void => {
    this.#connection.current?.writes.changeVisibility(
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
      return this.#rows.isInner(id) ?
        MenuSession.EMPTY :
        MenuSession.forRow(
          HierarchyController.#addEntries(editing.presets),
          () => editing.document.tree.has(row.ownerId),
          (action) => this.#add(action, row.ownerId, row.anchor)
        );
    }
    if (!editing.selection.has(id)) {
      editing.selection.select([id]);
    }

    return MenuSession.forRow(
      HierarchyController.#rowEntries(editing, id, editing.overrides.role(id)),
      () => editing.overrides.exists(id),
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
      case "revert-overrides":
        this.#connection.current?.overrides.revertActor(id);
        break;
      case "apply-to-prefab":
        this.#connection.current?.overrides.applyToPrefab(id);
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
