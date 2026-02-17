# UIRenderer

The **UIRenderer** is an [ActorComponent](../actor/actor-component.md)
that provides an orthographic 2D overlay on top of the 3D scene.
It creates its own `OrthographicCamera` and a Three.js
`CSS2DRenderer` so that [UINode](./ui-node.md) and
[UISprite](./ui-sprite.md) elements are always drawn screen-aligned,
independently from the main 3D camera.

Typically a single `UIRenderer` is registered once on a dedicated
actor (e.g. `"camera2D"`). Every `UINode` created under that actor
auto-discovers the renderer and registers itself.

```ts
import { Actor, UIRenderer, UISprite } from "@jolly-pixel/engine";

const camera2D = new Actor(world, { name: "camera2D" })
  .addComponent(UIRenderer, { near: 1 });
```

## How it works

1. On construction the component creates an `OrthographicCamera`
   sized to match the current canvas and appends a `CSS2DRenderer`
   DOM element on top of the WebGL canvas.
2. It listens to the game renderer's `resize` event and
   automatically updates both the CSS overlay size and every
   registered node position.
3. On every `draw` event it renders the scene through the
   orthographic camera so that CSS2D objects (used by
   [UIText](./ui-sprite.md)) stay in sync with the 3D world.

## Constructor

```ts
interface UIRendererOptions {
  /** Near clipping plane of the orthographic camera. */
  near?: number;
  /** Far clipping plane of the orthographic camera. */
  far?: number;
  /** Z position of the camera (draw order). */
  zIndex?: number;
}
```

| Option | Default | Description |
| ------ | ------- | ----------- |
| `near` | `0.1` | Near clipping plane |
| `far` | `2000` | Far clipping plane |
| `zIndex` | `10` | Camera Z position — controls draw order |

## Creating a HUD element

Once a `UIRenderer` exists, child actors can register
[UISprite](./ui-sprite.md) components that are automatically
positioned relative to the screen edges.

```ts
const button = new Actor(world, {
  name: "startButton",
  parent: camera2D
})
  .addComponentAndGet(UISprite, {
    anchor: { x: "center", y: "top" },
    offset: { y: -80 },
    size: { width: 200, height: 60 },
    style: { color: 0x0077ff },
    styleOnHover: { color: 0x0099ff },
    text: {
      textContent: "Start",
      style: {
        color: "#ffffff",
        fontSize: "20px",
        fontWeight: "bold"
      }
    }
  });

button.onClick.connect(() => {
  console.log("Start clicked!");
});
```

## Updating positions at runtime

When you change the offset or anchor of a node after creation
you can force a full re-layout by calling `updateWorldPosition`:

```ts
const uiRenderer = camera2D.getComponent(UIRenderer)!;
uiRenderer.updateWorldPosition();
```

## Cleanup

Calling `clear()` destroys every registered node, removes the
CSS overlay from the DOM, and unsubscribes from renderer events:

```ts
uiRenderer.clear();
```

## API

```ts
class UIRenderer extends ActorComponent {
  static ID: symbol;
  camera: THREE.OrthographicCamera;
  nodes: UINode[];

  addChildren(node: UINode): void;
  updateWorldPosition(): void;
  clear(): void;
}
```

## See also

- [UINode](./ui-node.md) — base positioning component
- [UISprite](./ui-sprite.md) — interactive sprite with events
- [ActorComponent](../actor/actor-component.md) — component base type
- [Renderers](../components/renderers.md) — 3D renderer components
