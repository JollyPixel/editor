# PixelDrawPanel

`<pixel-draw-panel>` is a Lit component that connects editor controls to one or
more `PixelArtCanvas` instances. The panel owns the controls and texture tabs;
the host owns texture creation, removal and persistence.

```ts
import "@jolly-pixel/editor.pixel-art";
import type { PixelDrawPanel } from "@jolly-pixel/editor.pixel-art";

const panel = document.querySelector<PixelDrawPanel>("pixel-draw-panel")!;
const canvas = await panel.initialize({
  texture: { size: { x: 64, y: 64 } },
  defaultMode: "paint"
});
```

A host that owns a texture list calls `configure()` once, then `addTexture()`
per texture:

```ts
await panel.configure({ zoom: { max: 32 } });
panel.addTexture({ id: "body", name: "Body", texture: { size: { x: 64, y: 64 } } });
panel.addTexture({ id: "trim", name: "Trim", texture: { size: { x: 32, y: 32 } } });
panel.activeTextureId = "body";
```

Each texture has its own canvas, pixels, history, UV map and viewport. Tool
mode, colors, tool options and view toggles carry over when switching.

## Properties

```ts
interface PixelDrawPanelProperties {
  uvAccess: UvAccess; // uv-access, "edit"
  allowUvCreateDelete: boolean; // allow-uv-create-delete, false
  uvResize: boolean; // uv-resize, false
  uvOverflow: number; // uv-overflow, 0
  normalMap: boolean; // normal-map, false
  colorDocked: boolean; // color-docked, false
  gridSizeLocked: boolean; // grid-size-locked, false
  textureImportPolicy: TextureImportPolicy; // texture-import-policy, "replace"
  textureTabs: TextureTabsMode; // texture-tabs, "auto"
  textureTabsVariant: TextureTabsVariant; // texture-tabs-variant, "default"
  textureTabsLine: boolean; // texture-tabs-line, false
  texturesAddable: boolean; // textures-addable, false
  texturesEditable: boolean; // textures-editable, false
  texturesClosable: boolean; // textures-closable, true
  textureAddLabel: string; // texture-add-label, "Add texture"
  theme: "light" | "dark" | "auto"; // "auto"
  fileDrops: readonly TextureFileDrop[]; // []
  keyBindings: KeyBindingSettings<PixelArtAction>; // PIXEL_ART_KEY_BINDINGS
  uvNets: UvNetLibrary; // built-in nets only
  activeTextureId: string | null; // setting an unknown id throws

  readonly canvasManager: PixelArtCanvas | null; // active canvas
  readonly textures: PixelDrawTexture[]; // tab order
  readonly resolvedTheme: "light" | "dark";
}
```

- `uv-access`: `edit` shows UV mode and its tools, `view` keeps only visibility
  controls and fill clipping, `none` hides UV controls and disables clipping.
  Use `view` when the host owns UV selection.
- `allow-uv-create-delete` shows the UV Create/Delete buttons.
- `uv-resize` and `uv-overflow` are forwarded to every canvas as `uvResizable`
  and `uvOverflow`.
- `grid-size-locked` hides the grid cell size picker, for a host that sets the
  size itself, such as an atlas tile size.
- `texture-tabs`: `auto` shows tabs from two textures, `always` shows them
  always. `texture-tabs-line` draws them as a thin line and hides Add.
- `texture-import-policy`: `replace` replaces the active texture, `add` emits
  `texture-add-request`, `ask` lets the user choose.
- `keyBindings`: see [Pixel-art key bindings](../keybindings/PixelArtKeyBindings.md).
- `uvNets`: see [`UvNetLibrary`](../uv/UvNetLibrary.md). The panel points it at
  the active texture's document.

## Events

```ts
interface PixelDrawPanelEvents {
  "texture-change": TextureChangeDetail; // { id, source: "user" | "api" }
  "texture-add-request": TextureAddRequestDetail;
  "texture-create-request": undefined; // Add button
  "texture-edit-request": TextureEditRequestDetail; // { id }
  "texture-close-request": TextureCloseRequestDetail; // { id }
  "texture-tabs-line-change": boolean;
  "color-docked-change": boolean;
  "theme-change": "light" | "dark";
  "canvas-hover-change": CanvasHoverChangeDetail; // { hovering }
}
```

The `texture-*-request` events are requests: the host does the work and calls
the matching panel method.

```ts
panel.textureImportPolicy = "add";
panel.addEventListener("texture-add-request", ({ detail }) => {
  detail.respondWith(persistAndAddTexture(detail.name, detail.source));
});
panel.addEventListener("texture-close-request", ({ detail }) => {
  panel.removeTexture(detail.id);
});
```

- `texture-add-request` carries the decoded image as a canvas in `source`.
  `respondWith()` keeps the panel busy until the host work settles.
- `texture-edit-request` needs `textures-editable`.
- `texture-change` is not emitted for the first texture.

## Methods

### initialize(options?: PixelDrawInitializeOptions): Promise<PixelArtCanvas>

Destroys existing textures, configures, then adds one texture. Call it after
the panel is connected.

### configure(options?: PixelArtCanvasOptions): Promise<void>

Sets the canvas options later `addTexture()` calls start from.

### addTexture(options: PixelDrawTextureOptions, addOptions?: AddTextureOptions): PixelArtCanvas

Throws when `configure()` was not called. Activates the texture unless
`addOptions.activate` is false. A `disabled` texture can never be active.

### removeTexture(id: string): void

Throws when removing the last texture. Removing the active texture activates its
right neighbor, or its left one.

### renameTexture(id: string, name: string): void

### updateTexture(id: string, update: TextureUpdate): void

Changes `name`, `tooltip` or `access`.

### onResize(): void

### announce(message: string): void

Shows a status message on the stage for three seconds.

## Access rights

Each texture has its own `PixelArtAccess`, passed to `addTexture()` or
`updateTexture()`. It defaults to `PIXEL_ART_CAPABILITIES.full`. The panel hides
or disables what the active texture does not grant; the server still checks
every command.

`TextureRoom` keeps one texture in step with its room: peer cursors, strokes,
selections and UV ghosts, the room's grants, and refused commands. Create it
after `addTexture()`.

```ts
import { TextureRoom } from "@jolly-pixel/editor.pixel-art";

const canvas = panel.addTexture({ id: textureId, name, document });
const textureRoom = new TextureRoom({
  room,
  canvas,
  panel,
  textureId,
  onRemoteUvDragging: (region) => {}
});

textureRoom.dispose();
```

## File drops

`fileDrops` lets the host claim other files dropped on the canvas. A claimed
file never reaches the image import.

```ts
interface TextureFileDrop {
  types: readonly string[]; // MIME types, matched while dragging and on drop
  extensions: readonly string[]; // case-insensitive, matched on drop
  label: string; // overlay text
  drop(file: File): void;
}
```

## View settings

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

class ViewPreferences {
  constructor(preferences: Preferences);

  follow(canvas: ViewCanvas): void;
  dispose(): void;
}
```

- `ViewSettings` is a frozen copy of the view toggles. The grid cell size is not
  part of it: it belongs to each texture.
- `ViewPreferences` keeps the toggles in the `pixel-art` preference scope.
  `follow()` tracks one canvas, so call it again when the active texture
  changes.

## TextureName

`TextureName.fromPath("art/hero.pixelart")` gives `"hero"`. An empty name
becomes `"Texture"`.
