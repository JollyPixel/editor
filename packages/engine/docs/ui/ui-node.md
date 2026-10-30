# UINode

A `UINode` positions an actor in screen space from an anchor, an offset and
a pivot, and follows canvas resizes. [UISprite](./ui-sprite.md) extends it
with visuals and interaction. It registers itself with the world's
[UIRenderer](./ui-renderer.md) when there is one.

```ts
import { Actor, UINode } from "@jolly-pixel/engine";

const hud = new Actor(world, {
  name: "hud",
  parent: camera2D
})
  .addComponent(UINode, {
    anchor: { x: "right", y: "top" },
    offset: { x: -16, y: -16 },
    size: { width: 100, height: 40 }
  });
```

## Anchor

The screen edge the element aligns to, per axis.

| Axis | Values | Description |
| ---- | ------ | ----------- |
| `x` | `"left"`, `"center"`, `"right"` | Horizontal screen edge |
| `y` | `"top"`, `"center"`, `"bottom"` | Vertical screen edge |

## Offset

Shifts the element away from its anchor, in world units. Positive X moves
right, positive Y moves up.

```ts
// 20 units from the left edge, 10 units below the top
{
  anchor: { x: "left", y: "top" },
  offset: { x: 20, y: -10 }
}
```

## Pivot

The normalized point of the element, from `0` to `1`, that sits at the
computed position.

| Pivot | Meaning |
| ----- | ------- |
| `{ x: 0, y: 0 }` | Bottom-left corner |
| `{ x: 0.5, y: 0.5 }` | Center (default) |
| `{ x: 1, y: 1 }` | Top-right corner |

## Size

Width and height in world units. `UISprite` sizes its mesh from it, and
anchoring uses it to keep the element on screen.

```ts
{
  size: { width: 200, height: 60 }
}
```

## Constructor

```ts
interface UINodeOptions {
  anchor?: {
    x?: "left" | "center" | "right";
    y?: "top" | "center" | "bottom";
  };
  offset?: {
    x?: number;
    y?: number;
  };
  size?: {
    width?: number;
    height?: number;
  };
  pivot?: {
    x?: number;
    y?: number;
  };
}
```

| Option | Default | Description |
| ------ | ------- | ----------- |
| `anchor` | `{ x: "center", y: "center" }` | Screen-edge alignment |
| `offset` | `{ x: 0, y: 0 }` | Offset from the anchor in world units |
| `size` | `{ width: 0, height: 0 }` | Element dimensions in world units |
| `pivot` | `{ x: 0.5, y: 0.5 }` | Normalized origin point (0 – 1) |

## Positioning examples

**Centered element:**

```ts
// Defaults — centered on screen
{ anchor: { x: "center", y: "center" } }
```

**Top-right corner with margin:**

```ts
{
  anchor: { x: "right", y: "top" },
  offset: { x: -16, y: -16 },
  pivot: { x: 1, y: 1 }
}
```

**Bottom-left health bar:**

```ts
{
  anchor: { x: "left", y: "bottom" },
  offset: { x: 20, y: 20 },
  size: { width: 300, height: 24 },
  pivot: { x: 0, y: 0 }
}
```

## API

```ts
class UINode extends ActorComponent {
  readonly layout: UILayout;

  addChildren(object: THREE.Object3D): void;
  updateToWorldPosition(): void;
}

class UILayout {
  constructor(options?: UINodeOptions);

  // The options with their defaults filled in, frozen.
  readonly size: { width: number; height: number };
  readonly pivot: { x: number; y: number };
  readonly anchor: { x: UIAnchorX; y: UIAnchorY };
  readonly offset: { x: number; y: number };

  // Position of the element's origin inside the screen bounds.
  position(bounds: UIBounds): { x: number; y: number };
}
```

`UILayout` holds no reference to the scene, so the positioning can be
computed for any bounds:

```ts
const layout = new UILayout({
  anchor: { x: "right", y: "top" },
  size: { width: 4, height: 2 }
});

layout.position({ left: -10, right: 10, top: 5, bottom: -5 });
// { x: 8, y: 4 }
```

## See also

- [UIRenderer](./ui-renderer.md) — the orthographic overlay system
- [UISprite](./ui-sprite.md) — visual + interactive UI element
- [ActorComponent](../actor/actor-component.md) — component base type
