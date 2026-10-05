# UI components

The package root registers `<pixel-draw-panel>` and exports the panel class and
controlled subcomponents. Import the package for registration, then initialize
a panel after it has been connected to the DOM:

```ts
import "@jolly-pixel/editor.pixel-art";
import type { PixelDrawPanel } from "@jolly-pixel/editor.pixel-art";

const panel = document.querySelector<PixelDrawPanel>("pixel-draw-panel")!;
const canvas = await panel.initialize({
  texture: { size: { x: 64, y: 64 } },
  defaultMode: "paint"
});
```

```html
<pixel-draw-panel style="width: 640px; height: 480px"></pixel-draw-panel>
```

`initialize()` configures and creates the initial texture. For a host that owns
a texture list, call `configure()` once and add canvases with `addTexture()`.
Each texture has its own `PixelArtCanvas`, pixels, history, UV map and viewport;
the active canvas is available as `panel.canvasManager`.

```ts
await panel.configure({ zoom: { max: 32 } });
panel.addTexture({ id: "body", name: "Body", texture: { size: { x: 64, y: 64 } } });
panel.addTexture({ id: "trim", name: "Trim", texture: { size: { x: 32, y: 32 } } });
panel.activeTextureId = "body";
```

The host owns texture creation and removal. `texture-create-request`,
`texture-add-request`, `texture-edit-request` and `texture-close-request` are
requests; handle them and call the corresponding panel methods. See
[`PixelDrawPanel` API](./panel/PixelDrawPanel.md) for signatures and event
payloads.

## UV access

`uv-access` controls the panel's UV tools:

| Value | Behavior |
|---|---|
| `edit` | UV mode and its editing toolbar are available (default). |
| `view` | UV editing is hidden; visibility controls and fill clipping remain. |
| `none` | UV controls and fill clipping are hidden; clipping is disabled. |

Region overlays still follow `UVMap.isVisible()` in every mode. Use `view` when
the host owns UV selection and `none` when the texture has no UV layout.

Region visibility uses one eye-and-chevron button in the UV toolbar (`edit`)
or bottom toolbar (`view`). Click it or hover for 200ms to open independent
Show all regions and Show region labels checkboxes. The popover stays open
while changing either option. Leaving both the button and popover for 200ms
closes it unless keyboard focus is inside. Mouse clicks on checkboxes still
allow hover closing; Escape or clicking outside also closes it.
It opens below the UV toolbar and above the bottom toolbar, adjusting at
viewport edges.
The button's accessible description summarizes the settings. It has no tooltip
because hovering opens the popover.

Region State uses the same hover delays and supports click and keyboard
opening. Region State, visibility and export popovers fade and scale from their
anchor over 120ms when opening and 90ms when closing. Reduced motion disables
the transitions.

The page editor saves the active drawing mode and both visibility settings in
local storage under `pixel-art:preferences`. They survive refresh and apply
when switching textures. Missing or invalid values use Paint with both
visibility settings off. The reusable panel leaves persistence to its host.

CSS parts: `uv-visibility-button`, `uv-visibility-menu`, `uv-show-all-checkbox`
and `uv-show-region-labels-checkbox`. The checkboxes replace the previous
`uv-show-all-button` and `uv-show-region-labels-button` parts.

## Layout composition

The bottom toolbar wraps control groups when the canvas area is too narrow
for one row. The Albedo/Normal switch appears only when the active texture has
normal maps enabled. Normal map settings remains available to enable them.
Disabling normal maps while viewing Normal restores Albedo and painting tools.
At canvas widths of 420px or less, the view buttons show icons with tooltips;
their accessible names remain available.

When the active texture has normal maps enabled, Export opens a menu with
Albedo texture, Normal map OpenGL (Y+), and Normal map DirectX (Y-) choices.
Albedo export downloads the painted pixels regardless of the displayed view.
Without normal maps enabled, Export downloads the albedo texture directly.

The root exports `ModeRail`, `ColorPickerRail`, `ColorDock`, `ColorSwatch`,
`ColorPaletteGrid`, `ColorPickerPopover` and `NormalMapDock` for custom layouts. They are controlled components: set their
properties and respond to their events. `PixelDrawPanel.ts` shows the wiring
used by the full panel. Their definitions and event types are in `src/`.

The package root also exports key-binding settings and defaults. See
[KeyBindingSettings](./keybindings/KeyBindingSettings.md).
