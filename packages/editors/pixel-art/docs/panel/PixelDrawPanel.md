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

Each texture is a separate `PixelArtCanvas`. The panel shares tool mode, colors
and tool options while switching canvases. The host creates assets and handles
requests from the panel:

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

## Access rights

Rights belong to the room of a texture, so each texture has its own
`PixelArtAccess`. Pass `access` to `addTexture()` or change it with
`updateTexture(id, { access })`; it defaults to `PixelArtAccess.full`. The
panel hides or disables what the active texture does not grant.

`RoomAccess` keeps one texture in step with its room. It builds the access
again on every `sync`, because a role change reconnects the room, and
announces the pixel-art commands the server refuses:

```ts
import { RoomAccess } from "@jolly-pixel/editor.pixel-art";

const access = new RoomAccess(room, panel, textureId);

// once the texture is closed
access.dispose();
```

Create it after `addTexture()`: when the room is already synced, it updates
the texture right away.

`PixelArtAccess.fromRights(room)` groups the pixel-art commands into five
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

`viewOnly` is true when no capability is granted; the bottom toolbar then shows
a "View only" badge. `PixelArtAccess.none` grants nothing. The server still
checks every command, so access only shapes the controls.

`announce(message)` shows a short status message on the stage for three
seconds, on the same line as texture import messages.

## Texture tabs and import

`texture-tabs` is `auto` (show from two textures) or `always`. The host can
control tab actions with `textures-addable`, `textures-editable` and
`textures-closable`. `texture-import-policy` is `replace` (default), `add` or
`ask`.

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
| `textures` | Texture records in tab order: `id`, `name`, `tooltip`, `badge`, `disabled`, `canvas`. |
| `activeTextureId` | Active id; setting it switches canvas. Unknown ids throw. |
| `keyBindings` | [`PixelArtKeyBindings`](../keybindings/KeyBindingSettings.md#pixelartkeybindings) used by the panel. |
| `uvAccess` | `"edit" \| "view" \| "none"`; defaults to `"edit"`. |
| `textureImportPolicy` | `"replace" \| "add" \| "ask"`; defaults to `"replace"`. |
| `textureTabs` | `"auto" \| "always"`; defaults to `"auto"`. |
| `normalMap` | Shows normal-map controls when true. Defaults to false. |
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
| `texture-edit-request` | `{ id }` | Active or disabled tab edit button is clicked. |
| `texture-close-request` | `{ id }` | Tab close button or middle click is used. |
| `color-docked-change` | `boolean` | Docked color picker is toggled. |
| `theme-change` | resolved theme | Theme changes or system preference changes in `auto`. |
| `canvas-hover-change` | `{ hovering: boolean }` | Pointer enters or leaves the canvas. |

## Exported subcomponents

The package root exports `ModeRail`, `ColorPickerRail`, `ColorDock`,
`ColorSwatch`, `ColorPaletteGrid`, `ColorPickerPopover` and `NormalMapDock` for custom layouts. They receive state through
properties and report user changes through events. See their source files under
[`src/`](../../src/) for property and event contracts.
