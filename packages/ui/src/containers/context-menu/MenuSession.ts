// Import Internal Dependencies
import type {
  ContextMenuEntry,
  ContextMenuItem
} from "./ContextMenu.ts";

export interface MenuItem<TAction extends string> extends ContextMenuItem {
  id: TAction;
  items?: never;
}

export interface MenuBranch<TAction extends string> extends ContextMenuItem {
  id: string;
  items: readonly MenuEntry<TAction>[];
}

export type MenuEntry<TAction extends string> =
  | MenuItem<TAction>
  | MenuBranch<TAction>
  | "separator";

export interface MenuPoint {
  x: number;
  y: number;
}

export type MenuAction<TAction extends string> = (
  action: TAction,
  point: MenuPoint
) => Promise<void> | void;

export interface PickerOption<TValue> {
  label: string;
  value: TValue;
}

export class MenuSession {
  static readonly EMPTY = MenuSession.from<never>([], () => undefined);

  static from<TAction extends string>(
    items: readonly MenuEntry<TAction>[],
    run: MenuAction<TAction>
  ): MenuSession {
    return new MenuSession(items, run as MenuAction<string>);
  }

  static forRow<TAction extends string>(
    items: readonly MenuEntry<TAction>[],
    exists: () => boolean,
    run: MenuAction<TAction>
  ): MenuSession {
    return MenuSession.from(items, async(action, point) => {
      if (exists()) {
        await run(action, point);
      }
    });
  }

  static picker<TValue>(
    options: readonly PickerOption<TValue>[],
    emptyLabel: string,
    run: (value: TValue) => Promise<unknown> | void
  ): MenuSession {
    if (options.length === 0) {
      return new MenuSession([
        {
          id: "empty",
          label: emptyLabel,
          disabled: true
        }
      ], () => undefined);
    }

    const items = options.map(({ label }, index) => {
      return {
        id: String(index),
        label
      };
    });

    return MenuSession.from(items, async(id) => {
      await run(options[Number(id)].value);
    });
  }

  readonly items: readonly ContextMenuEntry[];
  readonly #actionIds: ReadonlySet<string>;
  readonly #run: MenuAction<string>;

  constructor(
    items: readonly MenuEntry<string>[],
    run: MenuAction<string>
  ) {
    this.items = items;
    this.#actionIds = new Set(enabledActionIds(items));
    this.#run = run;
  }

  run(
    actionId: string,
    point: MenuPoint
  ): Promise<void> | void {
    if (!this.#actionIds.has(actionId)) {
      return undefined;
    }

    return this.#run(actionId, point);
  }
}

export function disableEntries<TAction extends string>(
  entries: readonly MenuEntry<TAction>[],
  disabled: (action: TAction) => boolean
): MenuEntry<TAction>[] {
  return entries.map((entry): MenuEntry<TAction> => {
    if (entry === "separator") {
      return entry;
    }
    if (entry.items !== undefined) {
      const items = disableEntries(entry.items, disabled);
      const allDisabled = items.every(
        (item) => item === "separator" || item.disabled === true
      );

      return {
        ...entry,
        items,
        ...allDisabled ? { disabled: true } : {}
      };
    }

    return disabled(entry.id) ?
      {
        ...entry,
        disabled: true
      } :
      entry;
  });
}

function enabledActionIds(
  entries: readonly MenuEntry<string>[]
): string[] {
  return entries.flatMap((entry) => {
    if (entry === "separator" || entry.disabled === true) {
      return [];
    }

    return entry.items === undefined ? [entry.id] : enabledActionIds(entry.items);
  });
}
