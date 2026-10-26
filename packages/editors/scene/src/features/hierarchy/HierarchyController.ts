// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";
import {
  MenuSession,
  resolveReparentMoves,
  SubscriptionController,
  type JollyRenameDetail,
  type JollyReparentDetail,
  type JollySelectDetail,
  type JollyToggleExpandDetail,
  type JollyToggleVisibleDetail,
  type TreeNode
} from "@jolly-pixel/ui";
import type {
  SceneChange,
  SceneCommand
} from "@jolly-pixel/asset.scene/client";

// Import Internal Dependencies
import type { SceneEditing } from "../../editing/SceneEditing.ts";
import { actorTreeNodes } from "./actorTreeNodes.ts";
import {
  addEntries,
  presetOfAction,
  rowEntries
} from "./hierarchyMenu.ts";

export interface HierarchyView {
  beginRename(id: string): void;
}

export class HierarchyController {
  #host: ReactiveControllerHost;
  #view: HierarchyView;
  #connection: SubscriptionController<SceneEditing>;
  #nodes: TreeNode[] = [];
  #collapsed = new Set<string>();

  #rebuild = (): void => {
    const editing = this.#connection.current;
    if (editing !== null) {
      this.#nodes = actorTreeNodes(
        editing.document.tree,
        editing.presence.selections
      );
    }
    this.#host.requestUpdate();
  };

  #onChange = (
    change: SceneChange
  ): void => {
    const parentId = destinationParent(change.command);
    if (parentId !== null) {
      this.#collapsed.delete(parentId);
    }
    this.#rebuild();
  };

  #onSelection = (): void => {
    const editing = this.#connection.current;
    for (const id of editing?.selection.ids ?? []) {
      this.#expandAncestors(id);
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
    return this.#nodes;
  }

  get selected(): string[] {
    return [...this.#connection.current?.selection.ids ?? []];
  }

  get expanded(): string[] {
    return [...this.#connection.current?.document.tree.actorIds() ?? []]
      .filter((id) => !this.#collapsed.has(id));
  }

  get hasSelection(): boolean {
    return (this.#connection.current?.selection.primary ?? null) !== null;
  }

  attach(
    editing: SceneEditing
  ): void {
    this.#collapsed.clear();
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
      this.#collapsed.delete(id);
    }
    else {
      this.#collapsed.add(id);
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
    const moves = resolveReparentMoves({
      nodes: this.#nodes,
      ...event.detail
    });
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
    return this.openMenu(null);
  }

  openMenu(
    id: string | null
  ): MenuSession {
    const editing = this.#connection.current;
    if (editing === null) {
      return MenuSession.EMPTY;
    }
    if (id === null) {
      return MenuSession.from(
        addEntries(),
        (action) => this.#add(action, null)
      );
    }
    if (!editing.selection.has(id)) {
      editing.selection.select([id]);
    }

    return MenuSession.forRow(
      rowEntries(),
      () => editing.document.tree.has(id),
      (action) => this.#runRow(action, id)
    );
  }

  async #runRow(
    action: string,
    id: string
  ): Promise<void> {
    const editing = this.#connection.current;
    switch (action) {
      case "rename":
        this.#view.beginRename(id);
        break;
      case "duplicate":
        editing?.actions.duplicateSelection();
        break;
      case "delete":
        editing?.actions.removeSelection();
        break;
      default:
        await this.#add(action, id);
    }
  }

  async #add(
    action: string,
    parentId: string | null
  ): Promise<void> {
    const actions = this.#connection.current?.actions;
    const preset = presetOfAction(action);
    if (actions === undefined || preset === null) {
      return;
    }

    if (parentId !== null) {
      this.#collapsed.delete(parentId);
    }
    await actions.addActor(preset, parentId);
  }

  #expandAncestors(
    id: string
  ): void {
    const tree = this.#connection.current?.document.tree;
    for (const parentId of tree?.ancestorIds(id) ?? []) {
      this.#collapsed.delete(parentId);
    }
  }
}

function destinationParent(
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
