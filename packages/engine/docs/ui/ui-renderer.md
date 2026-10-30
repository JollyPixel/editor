# UIRenderer

`UIRenderer` draws a 2D overlay over the 3D scene with its own
`OrthographicCamera`, plus a `CSS2DRenderer` for text, so
[UINode](./ui-node.md) and [UISprite](./ui-sprite.md) elements stay
screen-aligned. Add one per world, usually on a dedicated actor; nodes
register with it on their own.

```ts
import { Actor, UIRenderer, UISprite } from "@jolly-pixel/engine";

const camera2D = new Actor(world, { name: "camera2D" })
  .addComponent(UIRenderer, { near: 1 });
```

On a canvas resize it resizes the overlay and repositions every node.

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

Child actors add [UISprite](./ui-sprite.md) components positioned against
the screen edges:

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

After changing a node's offset or anchor, `updateWorldPosition()` lays out
every node again:

```ts
const uiRenderer = camera2D.getComponent(UIRenderer)!;
uiRenderer.updateWorldPosition();
```

## Cleanup

`clear()` destroys every registered node, removes the CSS overlay and stops
listening to the renderer. Destroying the component calls it:

```ts
uiRenderer.clear();
```

## API

```ts
class UIRenderer extends ActorComponent {
  /** The renderer registered for this world, if any. */
  static for(world: World): UIRenderer | undefined;
  camera: THREE.OrthographicCamera;
  nodes: UINode[];

  addChildren(node: UINode): void;
  removeChildren(node: UINode): void;
  updateWorldPosition(): void;
  clear(): void;
}
```

## See also

- [UINode](./ui-node.md) — base positioning component
- [UISprite](./ui-sprite.md) — interactive sprite with events
- [ActorComponent](../actor/actor-component.md) — component base type
- [Renderers](../components/renderers.md) — 3D renderer components
