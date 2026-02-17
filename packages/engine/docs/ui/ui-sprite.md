## UISprite

A **UISprite** is a [UINode](./ui-node.md) that renders a flat
rectangular mesh and provides pointer interaction signals. It is
the main building block for buttons, panels, icons, and other
interactive 2D elements drawn by the
[UIRenderer](./ui-renderer.md).

```ts
import { Actor, UISprite } from "@jolly-pixel/engine";

const btn = new Actor(world, {
  name: "playButton",
  parent: camera2D
})
  .addComponentAndGet(UISprite, {
    anchor: { x: "center", y: "center" },
    size: { width: 180, height: 50 },
    style: { color: 0x0077ff },
    text: { textContent: "Play" }
  });

btn.onClick.connect(() => console.log("Clicked!"));
```

### Style

The `style` option controls the default appearance of the sprite's
`MeshBasicMaterial`. An optional `styleOnHover` is automatically
swapped in when the pointer enters the element and reverted when
it leaves.

```ts
interface UISpriteStyle {
  color?: THREE.ColorRepresentation;
  map?: THREE.Texture;
  opacity?: number;
}
```

| Property | Default | Description |
| -------- | ------- | ----------- |
| `color` | `0xffffff` | Fill color of the material |
| `map` | `null` | Texture applied to the mesh |
| `opacity` | `1` | Transparency (0 fully transparent – 1 opaque) |

```ts
.addComponentAndGet(UISprite, {
  size: { width: 64, height: 64 },
  style: {
    map: myTexture,
    opacity: 0.9
  },
  styleOnHover: {
    color: 0xaaddff
  }
});
```

### Text

Passing a `text` option embeds a **UIText** label rendered with the
CSS2DRenderer on top of the sprite mesh. The text is a regular HTML
`<div>` styled via CSS properties.

```ts
interface UITextOptions {
  textContent?: string;
  style?: UITextStyle;
  /** Z offset in front of the sprite mesh. */
  zOffset?: number;
}
```

| Property | Default | Description |
| -------- | ------- | ----------- |
| `textContent` | `""` | Initial text content |
| `style` | see below | CSS style properties |
| `zOffset` | `0.1` | Z distance in front of the mesh |

Default text style:

```ts
{
  color: "#ffffff",
  fontSize: "14px",
  fontFamily: "Arial, sans-serif",
  whiteSpace: "nowrap"
}
```

All standard CSS text properties are supported: `color`,
`fontSize`, `fontFamily`, `fontWeight`, `textAlign`, `lineHeight`,
`letterSpacing`, `textTransform`, `textShadow`, `padding`,
`backgroundColor`, `borderRadius`, `opacity`, and `whiteSpace`.

### Signals

`UISprite` exposes [SignalEvent](../components/signal.md) instances
for every pointer interaction. Subscribe with `connect` and
unsubscribe with `disconnect`.

| Signal | Fires when |
| ------ | ---------- |
| `onPointerEnter` | Pointer first enters the sprite bounds |
| `onPointerLeave` | Pointer leaves the sprite bounds |
| `onPointerDown` | Left mouse button pressed over the sprite |
| `onPointerUp` | Left mouse button released (was pressed over sprite) |
| `onClick` | Full click — down and up while still over the sprite |
| `onDoubleClick` | Two clicks within 300 ms |
| `onRightClick` | Right mouse button released over the sprite |
| `onHover` | Same as `onPointerEnter` (convenience alias) |

```ts
const sprite = actor.addComponentAndGet(UISprite, {
  size: { width: 100, height: 40 },
  style: { color: 0x333333 }
});

sprite.onClick.connect(() => console.log("clicked"));
sprite.onDoubleClick.connect(() => console.log("double click"));
sprite.onPointerEnter.connect(() => console.log("enter"));
sprite.onPointerLeave.connect(() => console.log("leave"));
sprite.onRightClick.connect(() => console.log("right click"));
```

### Hover styling

When `styleOnHover` is provided the material is updated
automatically on pointer enter and restored on pointer leave.
No manual signal wiring is needed.

```ts
.addComponentAndGet(UISprite, {
  size: { width: 120, height: 40 },
  style: { color: 0x222222, opacity: 0.8 },
  styleOnHover: { color: 0x4444ff, opacity: 1 }
});
```

### Hit testing

`UISprite` performs hit testing every frame in its `update` loop
by projecting the mouse world position onto the mesh bounding box.
The `isPointerOver()` method is available if you need to query the
hover state manually:

```ts
if (sprite.isPointerOver()) {
  // pointer is currently over this sprite
}
```

### Constructor

```ts
interface UISpriteOptions extends UINodeOptions {
  style?: UISpriteStyle;
  styleOnHover?: UISpriteStyle;
  text?: UITextOptions;
}
```

| Option | Default | Description |
| ------ | ------- | ----------- |
| `style` | `{}` | Default material style |
| `styleOnHover` | `null` | Style applied on pointer hover |
| `text` | — | Optional text label overlay |

All [UINode options](./ui-node.md) (`anchor`, `offset`, `size`,
`pivot`) are also accepted.

### API

```ts
class UISprite extends UINode {
  mesh: THREE.Mesh;

  onPointerEnter: SignalEvent;
  onPointerLeave: SignalEvent;
  onPointerDown: SignalEvent;
  onPointerUp: SignalEvent;
  onClick: SignalEvent;
  onDoubleClick: SignalEvent;
  onRightClick: SignalEvent;
  onHover: SignalEvent;

  isPointerOver(): boolean;
  destroy(): void;
}
```

### See also

- [UINode](./ui-node.md) — base positioning component
- [UIRenderer](./ui-renderer.md) — the orthographic overlay system
- [Signal](../components/signal.md) — event system used by signals
- [Renderers](../components/renderers.md) — 3D renderer components
