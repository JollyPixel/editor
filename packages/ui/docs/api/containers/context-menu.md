# `jolly-context-menu`

`jolly-context-menu` is a list of actions opened at a point, usually where the
user right-clicked. It holds no target: the consumer decides what the menu is
for, fills `items`, and runs the chosen action.

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

| Property | Attribute | Type | Default |
|---|---|---|---|
| `items` | none | `readonly ContextMenuEntry[]` | `[]` |
| `label` | `label` | `string` | `""` |

`ContextMenuEntry` is a `ContextMenuItem` or the string `"separator"`. An item
has an `id`, a `label`, and optional `icon`, `disabled`, `intent` and `items`
(see [Submenus](#submenus)). An item
with `intent: "danger"` is drawn in the danger color, for destructive actions
such as Delete. When one item has an icon, every item keeps an icon column so
the labels line up. `label` names the menu for assistive technology.

`openAt(x, y)` opens the menu with its top-left corner at a point in viewport
pixels. It flips above the point when there is no room below and stays inside
the viewport. Calling it while the menu is open moves it. Called while a
pointer button is held, as Linux fires `contextmenu` on press, it shows the
menu on release so that release does not close it. `close()` closes it, and
the read-only `open` is `true` while it shows.

The menu fades and scales in from the point it opened at, and out on close,
with the [dialog motion](./dialog.md#motion) tokens.

The menu is a native `popover="auto"`: a click outside or Escape closes it. It
holds an [input layer](../interaction/README.md#input-layers) while open.
Opening focuses the first enabled item. Up and Down move between enabled items
and wrap, Home and End jump to the ends, Enter or Space chooses, and Tab
closes. Moving the pointer over an item focuses it.

## Submenus

An item with `items` opens a submenu instead of being chosen, and shows a
chevron. Submenus nest to any depth.

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

A submenu opens beside its item, on the right, and on the left when the
right side has no room for a submenu at the menu's `max-width`. Deeper levels
keep the side their parent opened on. Its first item lines up with the item
that opened it. The chevron sits on the side the submenu opens on and points
toward it.

Resting the pointer on the item opens the submenu after 150 ms. Resting on
another item of the same menu closes it after 300 ms, so the pointer can cross
a neighbour on the way into it. A click opens it at once. Right Arrow, Enter
or Space opens it and focuses its first enabled item. Left Arrow or Escape
closes it and focuses its item again. A click outside every level closes the
whole menu.

The submenu item's `id` is never emitted. An item whose `items` holds no item,
or that is `disabled`, does not open.

## Events

Choosing an item closes the menu, returns focus to the element that was focused
when `openAt` ran, then emits `jolly-context-action` with `{ id }`. The event
comes last so an action that moves focus, such as starting a rename or opening
a dialog, keeps it. Closing without a choice emits nothing.

A right-click does not focus its target in every browser. Focus it before
`openAt` so focus has somewhere to return. Shift+F10 on a focused element fires
the same `contextmenu` event, with `button` set to `-1` and a position the
browser picks.

## Menu sessions

A `MenuSession` keeps a menu's entries together with the function that runs
them, so the id a `jolly-context-action` event carries never has to be mapped
back to an action by hand. `ContextMenuController` remembers which session is
open and runs the chosen id on it.

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

### `MenuEntry<TAction>`

A `MenuItem<TAction>` (an item whose `id` is a `TAction`), a `MenuBranch<TAction>`
(a submenu: any `id`, and `items` holding more entries) or `"separator"`. The
run function of a session built from them receives a `TAction`.

### `MenuPoint`

`{ x, y }` in viewport pixels: where the menu opened or the action was asked
for.

### `MenuSession.from(items, run)`

Returns a session listing `items`. `session.run(actionId, point)` calls
`run(action, point)` only when `actionId` is the id of an enabled item in
`items`, at any depth but not inside a disabled submenu. Any other id, a
submenu's own id among them, does nothing and returns `undefined`.

### `MenuSession.forRow(items, exists, run)`

Like `from`, but each action first calls `exists()` and runs only when it
returns `true`. Use it when the row may be removed while its menu is open, by
another peer for example.

### `MenuSession.picker(options, emptyLabel, run)`

Lists one item per `{ label, value }` option and calls `run(value)` with the
chosen one. With no options, it lists a single disabled item labelled
`emptyLabel`.

### `MenuSession.EMPTY`

A session that lists and runs nothing.

### `disableEntries(entries, disabled)`

Returns a copy of `entries` where every item for which `disabled(id)` returns
`true` is disabled. A submenu whose items end up all disabled is disabled too.
Items already disabled stay disabled.

### `new ContextMenuController(menu, sessionFor)`

`menu` returns the `jolly-context-menu` to fill. `sessionFor(id)` returns the
session for a row id, or for `null` when nothing was hit; pass
`() => MenuSession.EMPTY` when menus only open through `open`.

- `open(session, point)` fills the menu with `session.items` and opens it at
  `point`.
- `onContextAction` is a bound `jolly-context-action` listener. It runs the
  chosen id on the open session, with the point it opened at, then forgets
  that session.
- `onContextRequest` is a bound `jolly-context-request` listener for
  [`jolly-tree`](../data/tree.md): it opens `sessionFor(id)` at the event's
  point.
- `run(id, actionId, point)` runs an action of `sessionFor(id)` without opening
  the menu, for a toolbar button that repeats a menu action.
