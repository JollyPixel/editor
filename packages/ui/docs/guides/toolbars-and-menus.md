# Toolbars and menus

Build the strip of tools next to a viewport, open a menu from one of its
buttons, and keep viewport shortcuts quiet while a dialog or a menu is open.

## 1. Register the icons

```ts
// toolIcons.ts
import { svg } from "lit";
import { registerIcon } from "@jolly-pixel/ui/icon";

registerIcon("brush", svg`
  <path class="tone-fill" d="M4 20c4 0 6-2 6-5l-3-3c-3 0-5 2-3 8Z" />
  <path d="m10 15 9-9-3-3-9 9" fill="none" stroke="currentColor" stroke-width="2" />
`, { tone: "lime" });
```

```ts
import "./toolIcons.ts";
```

- Import the module for its side effect, before the toolbar renders. A
  `jolly-icon` drawn before its glyph is registered does not update.
- `@jolly-pixel/ui/icon` loads the registry without the other elements, so a
  module that only registers glyphs stays cheap in unit tests.
- `tone-fill` takes the tone given at registration. A `jolly-tool-button`
  drawing the icon tints its hover and active fill with it.

## 2. Lay out the tools

```html
<jolly-toolbar label="Sculpt tools" orientation="vertical">
  <jolly-tool-button icon="brush" label="Raise" active></jolly-tool-button>
  <jolly-tool-button icon="smooth" label="Smooth"></jolly-tool-button>
  <jolly-tool-button icon="shape" label="Brush shape" flyout-side="right">
    <jolly-tool-button slot="flyout" icon="circle" label="Circle"></jolly-tool-button>
    <jolly-tool-button slot="flyout" icon="square" label="Square"></jolly-tool-button>
  </jolly-tool-button>
</jolly-toolbar>
```

- `jolly-tool-button` is a square icon button. `label` is its accessible name
  and its tooltip.
- `active` marks the current tool. The toolbar does not track it: set it from
  the application state, one tool at a time.
- Content in the `flyout` slot turns the button into a trigger. The flyout
  opens on hover, and on click for touch, pen and keyboard. Clicking a button
  inside closes it.
- `jolly-toolbar` gives the strip the toolbar role. `jolly-rail` lays out the
  same strip with no role, for controls that are not a toolbar.
- To pick one value out of a few, a
  [`jolly-button-group`](../api/controls/button-group.md) with `icon-only` is a
  field: it emits `jolly-change` and takes part in an inspector.

## 3. Open a menu from a button

A `jolly-context-menu` opens at a point. Use the bottom-left corner of the
button:

```ts
import { ContextMenuController, MenuSession } from "@jolly-pixel/ui";

#menu = new ContextMenuController(() => this.menu, () => MenuSession.EMPTY);

#openLighting = (event: MouseEvent) => {
  const { left, bottom } = (event.currentTarget as HTMLElement).getBoundingClientRect();
  this.#menu.open(
    MenuSession.picker(kLightingOptions, "No lighting modes", (mode) => {
      this.view.update({ lighting: mode });
    }),
    { x: left, y: bottom }
  );
};
```

```ts
html`
  <jolly-button aria-haspopup="menu" @click=${this.#openLighting}>Lighting</jolly-button>
  <jolly-context-menu
    label="Lighting"
    @jolly-context-action=${this.#menu.onContextAction}
  ></jolly-context-menu>
`;
```

- `MenuSession.picker` builds one item per `{ label, value }` option and
  passes the chosen value. With no option, it shows one disabled item with the
  second argument as label. `MenuSession.from(items, run)` takes any entries,
  icons and submenus included.
- The menu flips above the point when there is no room below.
- Closing it returns focus to the button.
- `() => MenuSession.EMPTY` tells the controller that this menu only opens
  through `open()`.

## 4. Run a menu action from a button

With the row menu controller of [Hierarchy panels](./hierarchy-panels.md),
a toolbar button runs the same action without opening the menu:

```ts
html`
  <jolly-button
    icon="close"
    label="Delete layer"
    icon-only
    @click=${(event: MouseEvent) => this.#menu.run(this.selectedId, "delete", {
      x: event.clientX,
      y: event.clientY
    })}
  ></jolly-button>
`;
```

`run()` asks `openSession(id)` for the session, so a disabled entry stays
disabled from the button too.

## 5. Keep viewport keys out of overlays

An open `jolly-dialog`, `jolly-context-menu` or field popover holds an input
layer. While one is open, every `keydown` belongs to the UI. Tell the viewport
keyboard to skip those keys:

```ts
import { inputLayers } from "@jolly-pixel/ui";

const dispose = input.keyboard.addGuard(inputLayers);
```

The guard has the shape `@jolly-pixel/controls` expects. A plain listener asks
the same question:

```ts
window.addEventListener("keydown", (event) => {
  if (inputLayers.blocks(event)) {
    return;
  }
  shortcuts.handle(event);
});
```

## 6. Claim the keyboard for an overlay of your own

```ts
show(): void {
  if (!inputLayers.dismissAll()) {
    return;
  }

  this.panel.hidden = false;
  this.#release = inputLayers.push({
    dismiss: () => {
      this.hide();

      return true;
    }
  });
}

hide(): void {
  this.panel.hidden = true;
  this.#release?.();
  this.#release = null;
}
```

- `dismissAll()` closes every open layer, newest first. On `false`, one of
  them refused, such as a dialog that is not `dismissible`: do not open over
  it.
- The release function returned by `push()` can be called more than once.
- Hover flyouts, such as a `jolly-tool-button` flyout, hold no layer.
