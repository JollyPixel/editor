# UISprite

A `UISprite` is a [UINode](./ui-node.md) drawn as a flat rectangle, with
pointer signals: the building block for buttons, panels and icons.

```ts
import { Actor } from "@jolly-pixel/ecs";
import { UISprite } from "@jolly-pixel/backend.three";

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

btn.clicked.connect(() => console.log("Clicked!"));
```

## Style

`style` sets the sprite's `MeshBasicMaterial`. `styleOnHover` applies while
the pointer is over it, with no signal wiring needed.

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

## Text

`text` adds a `UIText` label over the sprite: an HTML `<div>` styled with
CSS properties.

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

`UITextStyle` accepts `color`, `fontSize`, `fontFamily`, `fontWeight`,
`textAlign`, `lineHeight`, `letterSpacing`, `textTransform`, `textShadow`,
`padding`, `backgroundColor`, `borderRadius`, `opacity` and `whiteSpace`.

## Signals

Each pointer interaction is a `SignalEvent`:

| Signal | Fires when |
| ------ | ---------- |
| `pointerEntered` | Pointer first enters the sprite bounds |
| `pointerExited` | Pointer leaves the sprite bounds |
| `pointerPressed` | Left mouse button pressed over the sprite |
| `pointerReleased` | Left mouse button released (was pressed over sprite) |
| `clicked` | Full click — down and up while still over the sprite |
| `doubleClicked` | Two clicks within 0.3 s of unscaled world time |
| `rightClicked` | Right mouse button released over the sprite |

```ts
const sprite = actor.addComponentAndGet(UISprite, {
  size: { width: 100, height: 40 },
  style: { color: 0x333333 }
});

sprite.clicked.connect(() => console.log("clicked"));
sprite.doubleClicked.connect(() => console.log("double click"));
sprite.pointerEntered.connect(() => console.log("enter"));
sprite.pointerExited.connect(() => console.log("leave"));
sprite.rightClicked.connect(() => console.log("right click"));
```

## Hit testing

The sprite tests the pointer against its bounds every frame.
`isPointerOver()` reads the result:

```ts
if (sprite.isPointerOver()) {
  // pointer is currently over this sprite
}
```

## Constructor

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

## API

```ts
class UISprite extends UINode {
  mesh: THREE.Mesh;

  readonly pointerEntered: SignalEvent;
  readonly pointerExited: SignalEvent;
  readonly pointerPressed: SignalEvent;
  readonly pointerReleased: SignalEvent;
  readonly clicked: SignalEvent;
  readonly doubleClicked: SignalEvent;
  readonly rightClicked: SignalEvent;

  isPointerOver(): boolean;
  destroy(): void;
}
```

## See also

- [UINode](./ui-node.md) — base positioning component
- [UIRenderer](./ui-renderer.md) — the orthographic overlay system
- [Renderers](../components/renderers.md) — 3D renderer components
