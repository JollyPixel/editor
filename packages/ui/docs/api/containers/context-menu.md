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
has an `id`, a `label`, and optional `icon`, `disabled` and `intent`. An item
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

## Events

Choosing an item closes the menu, returns focus to the element that was focused
when `openAt` ran, then emits `jolly-context-action` with `{ id }`. The event
comes last so an action that moves focus, such as starting a rename or opening
a dialog, keeps it. Closing without a choice emits nothing.

A right-click does not focus its target in every browser. Focus it before
`openAt` so focus has somewhere to return. Shift+F10 on a focused element fires
the same `contextmenu` event, with `button` set to `-1` and a position the
browser picks.
