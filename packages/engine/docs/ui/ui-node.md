# UINode

A **UINode** is an [ActorComponent](../actor/actor-component.md)
that positions an actor in screen space using an **anchor**,
**offset**, and **pivot** system. It is the base positioning layer
for all 2D UI elements — [UISprite](./ui-sprite.md) extends it to
add visuals and interaction.

When a [UIRenderer](./ui-renderer.md) exists in the game instance,
every new `UINode` automatically registers itself with the renderer.
Otherwise it falls back to listening to renderer `resize` events
directly.

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

The **anchor** determines which screen edge the element aligns to.
Anchors are independent on each axis.

| Axis | Values | Description |
| ---- | ------ | ----------- |
| `x` | `"left"`, `"center"`, `"right"` | Horizontal screen edge |
| `y` | `"top"`, `"center"`, `"bottom"` | Vertical screen edge |

When an anchor is set to `"left"`, the element is pushed against the
left edge of the screen. Combined with an offset you can create
consistent margins that survive window resizes.

## Offset

The **offset** shifts the element away from its anchor in
world units. Positive X moves right, positive Y moves up.

```ts
// 20 units from the left edge, 10 units below the top
{
  anchor: { x: "left", y: "top" },
  offset: { x: 20, y: -10 }
}
```

## Pivot

The **pivot** is a normalized origin point from `0` to `1` that
controls which part of the element sits at the computed position.

| Pivot | Meaning |
| ----- | ------- |
| `{ x: 0, y: 0 }` | Bottom-left corner |
| `{ x: 0.5, y: 0.5 }` | Center (default) |
| `{ x: 1, y: 1 }` | Top-right corner |

Setting the pivot to `{ x: 0, y: 1 }` makes the top-left corner
the origin — useful for left-aligned HUD panels anchored to the
top of the screen.

## Size

The **size** defines the width and height of the element in world
units. It is used by `UISprite` to create the mesh geometry and by
the anchoring logic to keep the element fully on-screen.

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
  get size(): { width: number; height: number };
  get pivot(): { x: number; y: number };

  addChildren(object: THREE.Object3D): void;
  updateToWorldPosition(): void;
}
```

## See also

- [UIRenderer](./ui-renderer.md) — the orthographic overlay system
- [UISprite](./ui-sprite.md) — visual + interactive UI element
- [ActorComponent](../actor/actor-component.md) — component base type
