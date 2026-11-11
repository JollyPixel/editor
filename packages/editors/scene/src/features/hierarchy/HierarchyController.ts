// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";
import type { AssetReferenceData } from "@jolly-pixel/asset";
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
import {
  addComponentEntries,
  addedComponentType,
  isAddComponentAction,
  type AddComponentAction
} from "../../components/addComponentEntries.ts";
import { EMPTY_ACTOR_ICON } from "../../components/SceneComponents.ts";
import type { ActorRole } from "../../editing/InstanceOverrides.ts";
import type { SceneEditing } from "../../editing/SceneEditing.ts";
import type { ActorAnchor } from "../../state/AnchorPicks.ts";
import type { ComponentFocus } from "../../state/SelectionStore.ts";
import {
  HierarchyRows,
  PREFAB_ICON
} from "./HierarchyRows.ts";
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
const kAddEntries: readonly MenuEntry<AddAction>[] = [
  {
    id: "add-actor",
    label: "Actor",
    icon: EMPTY_ACTOR_ICON
  },
  {
    id: "add-instance",
    label: "Scene instance…",
    icon: PREFAB_ICON
  }
];
const kTreeEntries: readonly MenuEntry<TreeAction>[] = [
  {
    id: "expand-all",
    label: "Expand all"
  },
  {
    id: "collapse-all",
    label: "Collapse all"
  }
];

export interface HierarchyView {
  beginRename(id: string): void;
  reveal(id: string): void;
}

type AddAction = "add-actor" | "add-instance";
type OverrideAction = "revert-overrides" | "apply-to-prefab";
type RowAction =
  | "rename"
  | "duplicate"
  | "delete"
  | OverrideAction
  | AddAction
  | AddComponentAction;
type ComponentAction = "duplicate" | "delete" | "revert-overrides";
type AnchorAction = AddAction | "show-in-asset";
type TreeAction = "expand-all" | "collapse-all";

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

    const { tree } = editing.document;

    return [
      {
        id: "group:add-child",
        label: "Add child",
        icon: "plus",
        disabled: !tree.canContain(id),
        items: [...kAddEntries]
      },
      {
        id: "group:add-component",
        label: "Add component",
        icon: "plus",
        disabled: !tree.canHoldComponents(id),
        items: addComponentEntries(editing.components)
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

  static #componentEntries(
    editing: SceneEditing,
    componentId: string
  ): MenuEntry<ComponentAction>[] {
    const { overrides } = editing;
    if (overrides.role(componentId) === "inner") {
      return [{
        ...kOverrideItems["revert-overrides"],
        disabled: !overrides.componentOverridden(componentId)
      }];
    }

    return [
      {
        id: "duplicate",
        label: "Duplicate",
        icon: "action-duplicate"
      },
      "separator",
      {
        id: "delete",
        label: "Remove",
        icon: "trash",
        intent: "danger"
      }
    ];
  }

  static #placedRow(
    command: SceneCommand
  ): string | null {
    switch (command.action) {
      case "actor-added":
        return command.actors[0]?.id ?? null;
      case "actor-moved":
        return command.id;
      case "component-added":
        return HierarchyRows.componentRowId(command.component.id);
      default:
        return null;
    }
  }

  #host: ReactiveControllerHost;
  #view: HierarchyView;
  #connection: SubscriptionController<SceneEditing>;
  #rows = HierarchyRows.EMPTY;
  #expansion = new TreeExpansion();

  #rebuild = (): void => {
    const editing = this.#connection.current;
    if (editing !== null) {
      this.#rows = HierarchyRows.read(editing.document.tree, {
        marks: editing.presence.selections,
        components: editing.components,
        naming: editing.assetSlots,
        loadable: editing.assetSlots,
        live: editing.live
      });
    }
    this.#host.requestUpdate();
  };

  #onChange = (
    change: SceneChange
  ): void => {
    this.#rebuild();
    const id = HierarchyController.#placedRow(change.command);
    if (id !== null) {
      this.#expansion.reveal(this.#rows.ancestorIds(id));
    }
  };

  #onSelection = (): void => {
    for (const id of this.selected) {
      this.#expansion.reveal(this.#rows.ancestorIds(id));
    }
    this.#host.requestUpdate();
  };

  #onAnchorPick = (
    picked: ActorAnchor
  ): void => {
    const id = HierarchyRows.anchorRowId(picked);
    this.#expansion.reveal(this.#rows.ancestorIds(id));
    this.#host.requestUpdate();
    this.#view.reveal(id);
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
        anchorPicks,
        presence,
        live,
        assetSlots
      } = editing;
      this.#rebuild();

      return [
        document.subscribe("change", this.#onChange),
        document.subscribe("reset", this.#rebuild),
        selection.subscribe("change", this.#onSelection),
        anchorPicks.subscribe("pick", this.#onAnchorPick),
        presence.subscribe("selectionsChange", this.#rebuild),
        live.subscribe("anchorsChange", this.#rebuild),
        live.subscribe("actorsChange", this.#rebuild),
        assetSlots.subscribe(this.#rebuild)
      ];
    });
  }

  get nodes(): TreeNode[] {
    return this.#rows.roots;
  }

  get selected(): string[] {
    const selection = this.#connection.current?.selection;
    if (selection === undefined) {
      return [];
    }

    const { focused } = selection;

    return focused === null ?
      [...selection.ids] :
      [HierarchyRows.componentRowId(focused.componentId)];
  }

  get expanded(): string[] {
    return this.#expansion.expanded(this.#rows.ids());
  }

  get hasSelection(): boolean {
    return this.#connection.current?.actions.canEditSelection() ?? false;
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
    const selection = this.#connection.current?.selection;
    if (selection === undefined) {
      return;
    }

    const { selected, id } = event.detail;
    const component = id === null || !selected.includes(id) ?
      null :
      this.#rows.componentRow(id);
    if (component === null) {
      selection.select(selected.filter((row) => this.#rows.isActor(row)));
    }
    else {
      selection.focus(component);
    }
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
    const editing = this.#connection.current;
    const drop = this.#rows.drop(event.detail);
    if (editing === null || drop === null) {
      return;
    }

    if (drop.kind === "component") {
      editing.document.moveComponent(drop.move.id, drop.move.beforeId);
    }
    else {
      editing.actions.move(drop.moves);
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
      kAddEntries,
      (action) => this.#add(action, null)
    );
  }

  treeMenu(): MenuSession {
    return MenuSession.from(kTreeEntries, (action) => {
      switch (action) {
        case "expand-all":
          this.#expansion.reveal(this.#rows.branchIds());
          break;
        case "collapse-all":
          this.#expansion.clear();
          break;
      }
      this.#host.requestUpdate();
    });
  }

  openMenu(
    id: string | null
  ): MenuSession {
    const editing = this.#connection.current;
    if (id === null || editing === null) {
      return this.addMenu();
    }
    const anchor = this.#rows.anchorRow(id);
    if (anchor !== null) {
      return this.#anchorMenu(editing, anchor, this.#rows.isInner(id));
    }
    const component = this.#rows.componentRow(id);
    if (component !== null) {
      return this.#componentMenu(editing, component);
    }
    if (editing.selection.focused !== null || !editing.selection.has(id)) {
      editing.selection.select([id]);
    }

    return MenuSession.forRow(
      HierarchyController.#rowEntries(editing, id, editing.overrides.role(id)),
      () => editing.overrides.exists(id),
      (action) => this.#runRow(action, id)
    );
  }

  #componentMenu(
    editing: SceneEditing,
    focus: ComponentFocus
  ): MenuSession {
    const { componentId } = focus;
    editing.selection.focus(focus);

    return MenuSession.forRow(
      HierarchyController.#componentEntries(editing, componentId),
      () => editing.live.componentEntry(componentId) !== null,
      (action) => {
        switch (action) {
          case "duplicate":
            this.duplicateSelected();
            break;
          case "delete":
            this.deleteSelected();
            break;
          case "revert-overrides":
            editing.overrides.revertComponent(componentId);
            break;
        }
      }
    );
  }

  async #runRow(
    action: RowAction,
    id: string
  ): Promise<void> {
    if (isAddComponentAction(action)) {
      await this.#connection.current?.actions.addComponent(
        id,
        addedComponentType(action)
      );

      return;
    }

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

  #anchorMenu(
    editing: SceneEditing,
    row: ActorAnchor,
    inner: boolean
  ): MenuSession {
    function exists(): boolean {
      return editing.overrides.exists(row.ownerId);
    }
    const add = inner ? [] : kAddEntries;
    const addTo = (
      action: AddAction
    ): Promise<void> => this.#add(action, row.ownerId, row.anchor);
    const reference = anchorAsset(editing, row);
    const { open } = editing.assetSlots;
    if (reference === null || open === null) {
      return MenuSession.forRow(add, exists, addTo);
    }

    const show: MenuItem<AnchorAction> = {
      id: "show-in-asset",
      label: `Show in ${editing.assetSlots.name(reference)}`,
      icon: "view-frame",
      disabled: editing.live.findAnchor(row.ownerId, row.anchor) === null
    };

    return MenuSession.forRow<AnchorAction>(
      add.length === 0 ? [show] : [...add, "separator", show],
      exists,
      async(action) => {
        if (action === "show-in-asset") {
          open(reference, row.anchor.key);
        }
        else {
          await addTo(action);
        }
      }
    );
  }

  async #add(
    action: AddAction,
    parentId: string | null,
    anchor?: SceneAnchorJSON
  ): Promise<void> {
    const actions = this.#connection.current?.actions;
    if (action === "add-instance") {
      await actions?.addInstance(parentId, anchor);
    }
    else {
      actions?.addActor(parentId, anchor);
    }
  }
}

function anchorAsset(
  editing: Pick<SceneEditing, "live" | "components">,
  row: ActorAnchor
): AssetReferenceData | null {
  const entry = editing.live.componentEntry(row.anchor.component);
  if (entry === null) {
    return null;
  }

  const slot = editing.components.find(entry.type)?.anchorAsset;

  return slot === undefined ? null : entry.assets?.[slot] ?? null;
}
