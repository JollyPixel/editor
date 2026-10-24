# `jolly-context-menu`

`jolly-context-menu` is a list of actions opened at a point. It holds no
target: the consumer fills `items` and runs the chosen action.

```ts
const menu = document.createElement("jolly-context-menu");
menu.label = "Row actions";

row.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  row.focus();
  menu.items = [
    { id: "rename", label: "Rename" },
    "separator",
    {
      id: "delete",
      label: "Delete",
      icon: "close",
      intent: "danger",
      disabled: locked
    }
  ];
  menu.openAt(event.clientX, event.clientY);
});

menu.addEventListener("jolly-context-action", (event) => {
  run(event.detail.id);
});
```

## Properties

```ts
interface ContextMenu {
  items: readonly ContextMenuEntry[]; // property only
  label: string; // accessible name of the menu

  readonly open: boolean;
}

type ContextMenuEntry = ContextMenuItem | "separator";

interface ContextMenuItem {
  id: string;
  label: string;
  icon?: IconName;
  disabled?: boolean;
  intent?: "danger"; // drawn in the danger colour
  items?: readonly ContextMenuEntry[]; // a submenu
}
```

When one item has an icon, every item keeps an icon column.

## Events

```ts
interface ContextMenuEvents {
  "jolly-context-action": { id: string; };
}
```

- Choosing an item closes the menu, returns focus to the element focused when
  `openAt` ran, then emits. An action that moves focus keeps it.
- Closing without a choice emits nothing.
- A right-click does not focus its target in every browser. Focus it before
  `openAt` so focus has somewhere to return.

## Methods

### `openAt(x: number, y: number): void`

Opens with the top-left corner at a viewport point.

- Flips above the point when there is no room below, and stays in the
  viewport.
- Moves the menu when it is already open.
- Called while a pointer button is held (Linux fires `contextmenu` on press),
  it shows on release.

### `close(): void`

Closes the menu.

## Keyboard and focus

- The menu is a native `popover="auto"`: a click outside or Escape closes it.
- It holds an [input layer](../interaction/input-layers.md) while open.
- Opening focuses the first enabled item. Hovering an item focuses it.
- Up and Down move between enabled items and wrap. Home and End jump to the
  ends.
- Enter or Space chooses. Tab closes.
- It uses the [dialog motion](./dialog.md#motion), from the point it opened at.

## Submenus

An item with `items` opens a submenu instead of being chosen. Submenus nest to
any depth.

```ts
menu.items = [
  {
    id: "new",
    label: "New asset",
    items: [
      { id: "new:map", label: "Voxel map" },
      { id: "new:texture", label: "Pixel art" }
    ]
  },
  "separator",
  { id: "delete", label: "Delete", intent: "danger" }
];
```

- A submenu opens on the right of its item, or on the left when the right has
  no room. Deeper levels keep their parent's side.
- Hovering the item opens it after a short delay, and a click opens it at once.
- Right Arrow, Enter or Space opens it and focuses its first enabled item.
  Left Arrow or Escape closes it.
- A click outside every level closes the whole menu.
- The submenu item's own `id` is never emitted.
- An item with no `items` entries, or `disabled`, does not open.

## Menu sessions

A `MenuSession` keeps entries together with the function that runs them, so an
emitted id never has to be mapped back by hand. `ContextMenuController` tracks
the open session and runs the chosen id on it.

```ts
const rowMenu: readonly MenuEntry<"rename" | "copy" | "delete">[] = [
  { id: "rename", label: "Rename" },
  { id: "copy", label: "Copy" },
  "separator",
  { id: "delete", label: "Delete", intent: "danger" }
];

const controller = new ContextMenuController(
  () => menu,
  (id) => id === null ? MenuSession.EMPTY : MenuSession.forRow(
    disableEntries(rowMenu, (action) => locked && action !== "copy"),
    () => rows.has(id),
    (action) => rowActions[action](id)
  )
);

tree.addEventListener("jolly-context-request", controller.onContextRequest);
menu.addEventListener("jolly-context-action", controller.onContextAction);
```

### Types

```ts
type MenuEntry<TAction extends string> =
  | MenuItem<TAction> // a ContextMenuItem whose id is a TAction
  | MenuBranch<TAction> // a submenu: any id, items holding more entries
  | "separator";

// Viewport pixels where the menu opened.
interface MenuPoint {
  x: number;
  y: number;
}

type MenuAction<TAction extends string> = (
  action: TAction,
  point: MenuPoint
) => Promise<void> | void;
```

### `MenuSession.from(items, run): MenuSession`

`session.run(actionId, point)` calls `run` only for the id of an enabled item,
at any depth, outside a disabled submenu. Any other id does nothing.

### `MenuSession.forRow(items, exists, run): MenuSession`

Like `from`, but runs an action only while `exists()` returns `true`, for a
row another peer may remove while its menu is open.

### `MenuSession.picker(options, emptyLabel, run): MenuSession`

One item per `{ label, value }` option; `run(value)` receives the chosen one.
With no options, a single disabled item labelled `emptyLabel`.

### `MenuSession.EMPTY`

Lists and runs nothing.

### `disableEntries(entries, disabled): MenuEntry[]`

A copy where every item with `disabled(id)` true is disabled. A submenu whose
items all end up disabled is disabled too.

### `new ContextMenuController(menu, openSession)`

```ts
new ContextMenuController(
  menu: () => Pick<ContextMenu, "items" | "openAt">,
  openSession: (id: string | null) => MenuSession
)
```

`openSession(null)` is asked when nothing was hit. Pass
`() => MenuSession.EMPTY` when menus only open through `open()`.

- `open(session, point)`: fills the menu and opens it.
- `onContextAction`: bound `jolly-context-action` listener. Runs the id on the
  open session, then forgets it.
- `onContextRequest`: bound listener for the
  [`jolly-tree`](../data/tree.md#opening-a-row-menu) `jolly-context-request`.
- `run(id, actionId, point)`: runs an action of `openSession(id)` without
  opening the menu, for a toolbar button.

### `menuPointBelow(event): MenuPoint`

The bottom-left corner of `event.currentTarget`, where a menu opened from a
button goes. When the target is not an `HTMLElement`, it returns the pointer
position.
