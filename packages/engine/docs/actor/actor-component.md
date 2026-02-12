## ActorComponent

The engine follows an **Entity-Component** pattern inspired by
game engines like Unity and Godot:

- **Entity** → [Actor](actor.md) — a node in the scene tree with
  a transform, but no logic or rendering on its own.
- **Component** → `ActorComponent` — a modular piece of data or
  behavior attached to an actor. Each component adds one
  responsibility (rendering, physics, scripting, etc.).

An actor gains its capabilities entirely through the components
attached to it. For example, the same actor can display a 3D model
by attaching a `ModelRenderer` and react to player input by
attaching a custom [Behavior](../components/behavior.md). This
composition-over-inheritance approach keeps each piece small,
reusable, and testable in isolation.

The engine ships with several built-in components:

| Component | Role |
| --------- | ---- |
| [ModelRenderer](../components/renderers.md#modelrenderer) | Renders a 3D model (OBJ, FBX, glTF) |
| [SpriteRenderer](../components/renderers.md#spriterenderer) | Renders a 2D sprite / spritesheet |
| [TiledMapRenderer](../components/renderers.md#tiledmaprenderer) | Renders a Tiled map |
| [TextRenderer](../components/renderers.md#textrenderer) | Renders 3D text |
| [Camera3DControls](../components/camera-3d-controls.md) | First-person camera with WASD + mouse look |
| [Behavior](../components/behavior.md) | Custom scripting with lifecycle hooks and decorators |

### Attaching components

Components are added to an actor with `registerComponent` or
`registerComponentAndGet`:

```ts
const actor = new Actor(gameInstance, { name: "Player" });

actor.registerComponent(ModelRenderer, {
  model: knightModel
});

actor.registerComponent(PlayerBehavior);
```

When constructed, a component automatically registers itself on
the actor's `components` list and is queued for its first `start()`
call on the next frame.

### Lifecycle

Components follow a lifecycle managed by the scene engine:

| Hook | When it runs |
| ---- | ------------ |
| `awake()` | Once, when the scene starts or when the actor is added |
| `start()` | Once, on the first frame after the component is created |
| `update(deltaTime)` | Every frame, receives the elapsed time in seconds |
| `destroy()` | When the actor or component is removed from the scene |

### API

```ts
export type StrictComponentEnum =
  | "ScriptBehavior"
  | "Camera"
  | "VoxelRenderer"
  | "SpriteRenderer"
  | "ModelRenderer"
  | "TiledMapRenderer"
  | "TextRenderer";

export type FreeComponentEnum = StrictComponentEnum | (string & {});

interface ActorComponent {
  actor: Actor;
  typeName: FreeComponentEnum;

  isDestroyed(): boolean;

  // Remove the component from its actor
  destroy(): void;
}
```

### Events

`ActorComponent` extends `EventEmitter` and emits:

| Event | When it fires |
| ----- | ------------- |
| `metadataInitialized` | After all decorator metadata (properties, signals, component refs) has been resolved |

### See also

- [Behavior](../components/behavior.md)
- [Signal](../components/signal.md)
