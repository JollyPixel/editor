// Import Third-party Dependencies
import type {
  ContextMenuItem,
  IconName
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { AssetSelection } from "../../catalog/AssetSelection.ts";

// CONSTANTS
const kActions = {
  open: {
    label: "Open",
    icon: "file",
    target: "asset"
  },
  "new-folder": {
    label: "New folder",
    icon: "new-folder",
    title: "New folder",
    target: "anything"
  },
  rename: {
    label: "Rename",
    icon: "pencil",
    title: "Rename (F2)",
    target: "one-row"
  },
  delete: {
    label: "Delete",
    icon: "trash",
    title: "Delete (Del)",
    intent: "danger",
    target: "rows"
  },
  replace: {
    label: "Replace",
    menuLabel: "Replace…",
    icon: "replace",
    title: "Replace the content with a file",
    target: "asset"
  },
  export: {
    label: "Export",
    menuLabel: "Export as ZIP",
    icon: "export",
    title: "Export as a ZIP archive",
    target: "asset"
  },
  share: {
    label: "Share",
    menuLabel: "Share link…",
    icon: "share",
    title: "Share a view-only link",
    target: "asset"
  }
} satisfies Record<string, AssetActionDefinition>;

type AssetActionTarget = "anything" | "asset" | "one-row" | "rows";

interface AssetActionDefinition {
  label: string;
  menuLabel?: string;
  icon: IconName;
  title?: string;
  intent?: "danger";
  target: AssetActionTarget;
}

export type AssetAction = keyof typeof kActions;

export type AssetLeafAction = {
  [TAction in AssetAction]: typeof kActions[TAction]["target"] extends "asset" ?
    TAction :
    never;
}[AssetAction];

export interface AssetMenuItem extends ContextMenuItem {
  id: AssetAction;
}

export interface AssetActionButton {
  id: AssetAction;
  label: string;
  title: string;
  icon: IconName;
  intent?: "danger";
}

export interface AssetActionsOptions {
  sharing: boolean;
}

export class AssetActions {
  #offered: ReadonlySet<string>;

  constructor(
    options: AssetActionsOptions
  ) {
    this.#offered = new Set(
      actionIds().filter((action) => action !== "share" || options.sharing)
    );
  }

  offers(
    id: string
  ): id is AssetAction {
    return this.#offered.has(id);
  }

  allows(
    action: AssetAction,
    selection: AssetSelection
  ): boolean {
    return this.#offered.has(action) &&
      targets(kActions[action].target, selection);
  }

  menuItems(
    actions: readonly AssetAction[]
  ): AssetMenuItem[] {
    return actions
      .filter((action) => this.#offered.has(action))
      .map((action) => menuItem(action));
  }

  buttons(): AssetActionButton[] {
    const buttons: AssetActionButton[] = [];
    for (const action of actionIds()) {
      const definition: AssetActionDefinition = kActions[action];
      if (this.#offered.has(action) && definition.title !== undefined) {
        buttons.push({
          id: action,
          label: definition.label,
          title: definition.title,
          icon: definition.icon,
          ...(definition.intent === undefined ? {} : { intent: definition.intent })
        });
      }
    }

    return buttons;
  }
}

function actionIds(): AssetAction[] {
  return Object.keys(kActions).filter(
    (id): id is AssetAction => Object.hasOwn(kActions, id)
  );
}

function menuItem(
  action: AssetAction
): AssetMenuItem {
  const definition: AssetActionDefinition = kActions[action];

  return {
    id: action,
    label: definition.menuLabel ?? definition.label,
    icon: definition.icon,
    ...(definition.intent === undefined ? {} : { intent: definition.intent })
  };
}

function targets(
  target: AssetActionTarget,
  selection: AssetSelection
): boolean {
  switch (target) {
    case "anything":
      return true;
    case "asset":
      return selection.asset !== null;
    case "one-row":
      return selection.nodeIds.length === 1;
    case "rows":
      return !selection.isEmpty;
    default:
      return target satisfies never;
  }
}
