// Import Third-party Dependencies
import {
  MenuSession,
  type ContextMenuItem,
  type MenuBranch,
  type MenuEntry,
  type MenuItem
} from "@jolly-pixel/ui";

export type MenuHandler = () => Promise<unknown> | unknown;

export class MenuActions {
  readonly #handlers = new Map<string, MenuHandler>();

  item(
    entry: Omit<ContextMenuItem, "items">,
    run: MenuHandler
  ): MenuItem<string> {
    this.#handlers.set(entry.id, run);

    return entry;
  }

  branch(
    entry: Omit<ContextMenuItem, "items">,
    items: readonly MenuEntry<string>[]
  ): MenuBranch<string> {
    const disabled = entry.disabled === true || items.every(
      (item) => item === "separator" || item.disabled === true
    );

    return {
      ...entry,
      disabled,
      items
    };
  }

  session(
    entries: readonly MenuEntry<string>[],
    exists: () => boolean = () => true
  ): MenuSession {
    return MenuSession.forRow(entries, exists, async(id) => {
      await this.#handlers.get(id)?.();
    });
  }
}
