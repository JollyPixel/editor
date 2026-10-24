# PixelDrawPanel

`<pixel-draw-panel>` is a Lit component that connects editor controls to one or
more [`PixelArtCanvas`](../../../../pixel-draw-renderer/docs/PixelArtCanvas.md)
instances. It owns the controls and texture tabs; the host owns texture
lifecycle and persistence.

```ts
import "@jolly-pixel/editor.pixel-art";
import type { PixelDrawPanel } from "@jolly-pixel/editor.pixel-art";

const panel = document.querySelector<PixelDrawPanel>("pixel-draw-panel")!;
const canvas = await panel.initialize({
  texture: { size: { x: 64, y: 64 } },
  defaultMode: "paint"
});
```

Call `initialize()` after connection; it resolves after the Lit render creates
the canvas host. It destroys any existing texture canvases before initializing
again. For multiple textures from startup, use `configure()` followed by
`addTexture()`.

## Texture lifecycle

Each texture is a separate `PixelArtCanvas`. The panel shares tool mode, colors,
tool options and view options while switching canvases. The host creates assets
and handles requests from the panel:

```ts
panel.textureImportPolicy = "add";
panel.addEventListener("texture-add-request", (event) => {
  const { name, source } = event.detail;
  const work = persistAndAddTexture(name, source);
  event.detail.respondWith(work);
});

panel.addEventListener("texture-close-request", ({ detail }) => {
  panel.removeTexture(detail.id);
});
```

`texture-add-request` is emitted for imports when policy is `add`, and from the
Add choice under `ask`. Its `source` is a decoded canvas. `respondWith()` lets
the panel show busy state until host work settles. `texture-create-request` is
the host-managed Add button; `texture-edit-request` asks the host to edit a tab.

## UV access and display

`uv-access` is `edit` (default), `view` or `none`. `edit` exposes UV mode and
editing tools; `view` exposes visibility controls and fill clipping; `none`
hides UV controls and disables clipping. UV region overlays still follow
`UVMap.isVisible()` in all modes. `allow-uv-create-delete` controls the UV
Create/Delete buttons and defaults to false.

## UV nets

`uvNets` is the [`UvNetLibrary`](../uv/UvNetLibrary.md) behind the "Unfold with" entries of the
region state menu and the "Edit nets" dialog. Every texture of the panel unfolds through its
default net. Without a host library, the panel keeps an in-memory one with the built-in nets.

## Grid

The view options popover at the top of the canvas edits the active canvas's
[`TextureGrid`](../../../../pixel-draw-renderer/docs/grid/TextureGrid.md):
visibility, UV snapping (with `uv-access="edit"` only) and cell size.
Grid visibility and snapping carry over when switching textures, like the region
toggles; the cell size belongs to each texture. Set `grid-size-locked` when the host decides the size,
such as an atlas tile size, to hide the size picker:

```ts
panel.gridSizeLocked = true;
panel.addTexture({ id, name, grid: { size: tileSize, visible: true } });
```

Holding `Alt` over the canvas drags UV regions off the grid.

## Access rights

Rights belong to the room of a texture, so each texture has its own
`PixelArtAccess`, the
`Grants` of its
room. Pass `access` to `addTexture()` or change it with
`updateTexture(id, { access })`; it defaults to `PIXEL_ART_CAPABILITIES.full`.
The panel hides or disables what the active texture does not grant.

`TextureRoom` keeps one texture in step with its room. It shows the peers'
cursors, stroke, selection and UV ghosts, and applies the room's grants at
once, then again whenever a `sync` changes them, because a role change
reconnects the room. It also announces the pixel-art commands the server
refuses:

```ts
import { TextureRoom } from "@jolly-pixel/editor.pixel-art";

const canvas = panel.addTexture({ id: textureId, name, document });
const textureRoom = new TextureRoom({
  room,
  canvas,
  panel,
  textureId,
  // optional, called while a peer drags a UV region
  onRemoteUvDragging: (region) => {}
});

// once the texture is closed
textureRoom.dispose();
```

Create it after `addTexture()`.

`PIXEL_ART_CAPABILITIES` groups the pixel-art commands into five
capabilities. A capability is granted only when every command in it can be
written:

- `pixels`: strokes, fills, selection edits, resizes and imports. Without it
  the texture's canvas gets
  [`pixelsLocked`](../../../../pixel-draw-renderer/docs/PixelArtCanvas.md#textureview--pixelslocked--pixelsreadonly--unavailablemodes),
  and import, clear, paste and the selection edit buttons are disabled.
- `uv`: moving, rotating and changing the state of UV regions. Without it
  `uv-access` acts as `view` at most for that texture.
- `uvStructure`: creating and deleting UV regions, combined with
  `allow-uv-create-delete`.
- `palette`: editing palette slots. Slots can still be used as brush colors.
- `normalMap`: the normal-map settings, which stay visible as read-only fields.

`readOnly` is true when no capability is granted; the bottom toolbar then shows
a "View only" badge. `PIXEL_ART_CAPABILITIES.none` grants nothing. The server
still checks every command, so access only shapes the controls.

`announce(message)` shows a short status message on the stage for three
seconds, on the same line as texture import messages.

## Texture tabs and import

`texture-tabs` is `auto` (show from two textures) or `always`. The host can
control tab actions with `textures-addable`, `textures-editable` and
`textures-closable`. `texture-import-policy` is `replace` (default), `add` or
`ask`.

With `textures-editable`, double clicking a tab, disabled ones included, or
pressing F2 on the focused tab emits `texture-edit-request`. The tab tooltip
says so.

`texture-tabs-line` draws the strip as a thin line of segments, one per
texture, that name their texture on hover. It hides the Add button. While the
strip shows, a toggle at the top of the left rail switches it and emits
`texture-tabs-line-change`; the host saves the choice if it wants to keep it.
`texture-tabs-variant` (`default` or `skew`) styles the strip when it is not a
line.

## Color palette

The color dock shows ten saved colors in five rows and two columns, centered
with the picker, immediately to its left. Click a slot to use its color for
both mouse buttons. Double click or press F2 to edit it. Enter or Space selects
a focused slot. Selection stays local to each texture view. Clicking outside
the canvas, the color controls and the Pick color toggle clears the selection
and keeps the brush color.

While a slot is selected in the dock, Pick color replaces that slot with the
sampled color. Docked picker changes also update it. Picker input previews
locally; each completed adjustment commits one undoable, synchronized edit.
Dismissal discards unfinished palette drafts and restores the saved color.
Peer edits refresh the selected brush unless a local draft is active.

Shift click a second slot to ramp from the selected one: the slots in between
are filled with an OKLab blend of the two colors, as one undoable edit, and the
clicked slot becomes the selection. On a locked palette, or on a slot next to
the selected one, a shift click only selects.

Every picker follows the shared color picker preferences (space, square or
wheel, channel fields, harmony). The settings button next to the hex field
changes them in place and saves them, so they also show up in the Color
picker settings page. Clicking a harmony swatch uses that color; right click
sets it as the background color when the picker is not docked.

Palette data belongs to the Pixel Document and survives saving, reload and
peer snapshots. Existing texture pixels keep their colors when a slot changes.
See the renderer's [ColorPalette API](../../../../pixel-draw-renderer/docs/ColorPalette.md).

## API

```ts
initialize(options?: PixelDrawInitializeOptions): Promise<PixelArtCanvas>
configure(options?: PixelArtCanvasOptions): Promise<void>
addTexture(options: PixelDrawTextureOptions, addOptions?: AddTextureOptions): PixelArtCanvas
removeTexture(id: string): void
renameTexture(id: string, name: string): void
updateTexture(id: string, update: TextureUpdate): void
onResize(): void
announce(message: string): void
```

| Member | Contract |
|---|---|
| `canvasManager` | Active canvas, or `null` before a texture is added. |
| `textures` | Texture records in tab order: `id`, `name`, `tooltip`, `disabled`, `canvas`. |
| `activeTextureId` | Active id; setting it switches canvas. Unknown ids throw. |
| `keyBindings` | [`KeyBindingSettings<PixelArtAction>`](../keybindings/PixelArtKeyBindings.md#settings) the panel binds while connected. Defaults to `PIXEL_ART_KEY_BINDINGS`. |
| `uvAccess` | `"edit" \| "view" \| "none"`; defaults to `"edit"`. |
| `uvNets` | [`UvNetLibrary`](../uv/UvNetLibrary.md) of the nets regions unfold with. |
| `textureImportPolicy` | `"replace" \| "add" \| "ask"`; defaults to `"replace"`. |
| `textureTabs` | `"auto" \| "always"`; defaults to `"auto"`. |
| `textureTabsVariant` | `"default" \| "skew"`; defaults to `"default"`. |
| `textureTabsLine` | Thin line strip when true. Defaults to false. |
| `normalMap` | Shows normal-map controls when true. Defaults to false. |
| `gridSizeLocked` | Hides the grid cell size picker when true. Defaults to false. |
| `theme` / `resolvedTheme` | Requested `"light" \| "dark" \| "auto"` theme and resolved `"light" \| "dark"` theme. |

`configure()` sets the canvas options used by later `addTexture()` calls. Per-
texture canvas options override configured options at the top level. The first
added texture becomes active; `disabled` textures cannot be activated. Removing
the last texture throws. Removing an active texture selects its right neighbor,
or its left neighbor when it was last.

## Events

| Event | `detail` | When |
|---|---|---|
| `texture-change` | `{ id, source: "user" \| "api" }` | Active texture changes after initial creation. |
| `texture-add-request` | `TextureAddRequestDetail` | Import asks the host to add an image. |
| `texture-create-request` | none | Host-managed Add button is clicked. |
| `texture-edit-request` | `{ id }` | A tab is double clicked, or F2 is pressed on it, with `textures-editable`. |
| `texture-tabs-line-change` | `boolean` | The rail toggle switches the line strip. |
| `texture-close-request` | `{ id }` | Tab close button or middle click is used. |
| `color-docked-change` | `boolean` | Docked color picker is toggled. |
| `theme-change` | resolved theme | Theme changes or system preference changes in `auto`. |
| `canvas-hover-change` | `{ hovering: boolean }` | Pointer enters or leaves the canvas. |

## View settings and texture names

`ViewSettings` is a frozen copy of the view toggles a host may save between
sessions. The grid cell size is not part of it, because it belongs to each
texture.

```ts
class ViewSettings {
  static capture(canvas: ViewCanvas): ViewSettings;

  readonly showAll: boolean;
  readonly showRegionLabels: boolean;
  readonly showSizeLabels: boolean;
  readonly showGrid: boolean;
  readonly snapToGrid: boolean;

  constructor(init: ViewSettingsInit);
  applyTo(canvas: ViewCanvas): void;
}
```

`ViewPreferences` keeps these toggles in the `pixel-art` preference scope.
`follow(canvas)` applies the saved values to the canvas, saves the user's
changes, and applies changes made in Settings. It follows one canvas at a time,
so call it again when the active texture changes. It never reads or writes
`gridSize`; the host sets the cell size.

```ts
class ViewPreferences {
  constructor(preferences: Preferences);

  follow(canvas: ViewCanvas): void;
  dispose(): void;
}
```

`TextureName.fromPath(path)` keeps the file name without its folders and
extension, so `"art/hero.pixelart"` gives `"hero"`. An empty name becomes
`"Texture"`.

## Exported subcomponents

The package root exports `ModeRail`, `ColorPickerRail`, `ColorDock`,
`ColorSwatch`, `ColorPaletteGrid` and `ColorPickerPopover` for custom layouts.
`NormalMapDock` is exported as a type only: the panel loads the element when
its normal-map dock first opens. The subcomponents receive state through
properties and report user changes through events. See their source files under
[`src/`](../../src/) for property and event contracts.
