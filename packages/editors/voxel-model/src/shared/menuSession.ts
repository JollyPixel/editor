// Import Third-party Dependencies
import type {
  ContextMenuEntry,
  ContextMenuItem
} from "@jolly-pixel/ui";

export interface MenuItem<TAction extends string> extends ContextMenuItem {
  id: TAction;
}

export type MenuEntry<TAction extends string> = MenuItem<TAction> | "separator";

/** Viewport pixels where the action was asked for; a follow-up menu opens there. */
export interface MenuPoint {
  x: number;
  y: number;
}

export type MenuAction<TAction extends string> = (
  action: TAction,
  point: MenuPoint
) => Promise<void> | void;

export interface MenuSession {
  items: readonly ContextMenuEntry[];
  run(
    actionId: string,
    point: MenuPoint
  ): Promise<void> | void;
}

export function menuSession<TAction extends string>(
  items: readonly MenuEntry<TAction>[],
  run: MenuAction<TAction>
): MenuSession {
  return {
    items,
    run: (actionId, point) => {
      const item = items.find(
        (entry): entry is MenuItem<TAction> => entry !== "separator" && entry.id === actionId
      );

      return item === undefined ? undefined : run(item.id, point);
    }
  };
}

export function rowMenuSession<TAction extends string>(
  items: readonly MenuEntry<TAction>[],
  exists: () => boolean,
  run: MenuAction<TAction>
): MenuSession {
  return menuSession(items, async(action, point) => {
    if (exists()) {
      await run(action, point);
    }
  });
}

export interface PickerOption<TValue> {
  label: string;
  value: TValue;
}

export function pickerMenu<TValue>(
  options: readonly PickerOption<TValue>[],
  emptyLabel: string,
  run: (value: TValue) => Promise<unknown> | void
): MenuSession {
  if (options.length === 0) {
    return menuSession([{ id: "empty", label: emptyLabel, disabled: true }], () => undefined);
  }

  const items = options.map(({ label }, index) => {
    return {
      id: String(index),
      label
    };
  });

  return menuSession(items, async(id) => {
    await run(options[Number(id)].value);
  });
}

export const EMPTY_MENU: MenuSession = menuSession<never>([], () => undefined);

export function menuPointBelow(
  event: MouseEvent
): MenuPoint {
  const button = event.currentTarget;
  if (!(button instanceof HTMLElement)) {
    return { x: event.clientX, y: event.clientY };
  }

  const anchor = button.getBoundingClientRect();

  return { x: anchor.left, y: anchor.bottom };
}
