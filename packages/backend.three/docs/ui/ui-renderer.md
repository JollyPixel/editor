# UIRenderer

`UIRenderer` draws a 2D overlay over the 3D scene with its own
`OrthographicCamera`, plus a `CSS2DRenderer` for text, so
[UINode](./ui-node.md) and [UISprite](./ui-sprite.md) elements stay
screen-aligned. Add one per world, usually on a dedicated actor. Nodes do not
register with it: each one follows canvas resizes on its own.

```ts
import { Actor } from "@jolly-pixel/ecs";
import { UIRenderer, UISprite } from "@jolly-pixel/backend.three";

const camera2D = new Actor(world, { name: "camera2D" })
  .addComponent(UIRenderer, { near: 1 });
```

On a canvas resize it resizes the CSS overlay.

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

button.clicked.connect(() => {
  console.log("Start clicked!");
});
```

## Cleanup

Destroying the component removes its camera from the renderer, the CSS
overlay and its renderer listeners. UI nodes stay: their actors own them.

## API

```ts
class UIRenderer extends ActorComponent {
  readonly camera: THREE.OrthographicCamera;
}
```

## See also

- [UINode](./ui-node.md) — base positioning component
- [UISprite](./ui-sprite.md) — interactive sprite with events
- [Renderers](../components/renderers.md) — 3D renderer components
