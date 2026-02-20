# ActorComponent

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
| [TextRenderer](../components/renderers.md#textrenderer) | Renders 3D text |
| [Camera3DControls](../components/camera-3d-controls.md) | First-person camera with WASD + mouse look |
| [Behavior](../components/behavior.md) | Custom scripting with lifecycle hooks and decorators |

## Attaching components

Components are added to an actor with `addComponent` or
`addComponentAndGet`:

```ts
const actor = new Actor(world, { name: "Player" });

actor.addComponent(ModelRenderer, {
  model: knightModel
});

actor.addComponent(PlayerBehavior);
```

When constructed, a component automatically registers itself on
the actor's `components` list and is queued for its first `start()`
call on the next frame.

## Lifecycle

Components follow a lifecycle managed by the scene engine:

| Hook | When it runs |
| ---- | ------------ |
| `awake()` | Once, when the scene starts or when the actor is added |
| `start()` | Once, on the first frame after the component is created |
| `fixedUpdate(deltaTime)` | Every fixed step, at a constant rate (default 60 Hz). Use for physics and deterministic logic |
| `update(deltaTime)` | Every frame, receives the elapsed time in seconds. Use for rendering-related logic |
| `destroy()` | When the actor or component is removed from the scene |

Components that define `update()` or `fixedUpdate()` are
automatically registered for per-frame updates via the
`needUpdate` property. Setting `needUpdate = false` on a
component removes it from the update loop without destroying it.

## API

```ts
export type StrictComponentEnum =
  | "ScriptBehavior"
  | "Camera"
  | "VoxelRenderer"
  | "SpriteRenderer"
  | "ModelRenderer"
  | "TextRenderer";

export type FreeComponentEnum = StrictComponentEnum | (string & {});

interface ActorComponent {
  /** Sequential numeric identifier (per component class). */
  id: number;
  /** Persistent random hex identifier (16 characters). */
  persistentId: string;
  actor: Actor;
  typeName: FreeComponentEnum;

  /**
   * When true, the component receives update() and fixedUpdate()
   * calls. Automatically set when the component defines either
   * method. Set to false to pause updates without destroying.
   */
  needUpdate: boolean;

  /** Shortcut to `actor.world.context`. */
  get context(): TContext;

  isDestroyed(): boolean;

  /** Returns `"$typeName:$id-$persistentId"`. */
  toString(): string;

  // Remove the component from its actor
  destroy(): void;
}
```

## Accessing game context

The `context` getter provides a convenient shortcut to the
game instance context without navigating through `actor.world`:

```ts
class PlayerBehavior extends Behavior {
  update() {
    const { score } = this.context;
  }
}
```

## Events

`ActorComponent` extends `EventEmitter` and emits:

| Event | When it fires |
| ----- | ------------- |
| `metadataInitialized` | After all decorator metadata (properties, signals, component refs) has been resolved |

## See also

- [Behavior](../components/behavior.md)
- [Signal](../components/signal.md)
