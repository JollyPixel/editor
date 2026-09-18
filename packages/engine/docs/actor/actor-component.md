# ActorComponent

The engine follows an **Entity-Component** pattern inspired by
game engines like Unity and Godot:

- **Entity** → [Actor](actor.md): a node in the scene tree with
  a transform, but no logic or rendering on its own.
- **Component** → `ActorComponent`: a modular piece of data or
  behavior attached to an actor. Each component adds one
  responsibility (rendering, physics, scripting, etc.).

An actor gains its capabilities entirely through the components
attached to it. For example, the same actor can display a 3D model
by attaching a `ModelRenderer` and react to player input by
attaching a custom [Behavior](../components/behavior.md). This
composition-over-inheritance approach keeps each component focused
on one piece of behavior or rendering.

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
| `fixedUpdate(deltaTime, stepIndex)` | Every fixed step, at a constant rate (default 60 Hz). Use for physics and deterministic logic. `stepIndex` counts the steps within the current frame |
| `update(deltaTime, alpha)` | Every drawn frame, with the elapsed time in seconds. `alpha` is how far the frame sits between the last fixed step and the next one, in `[0, 1)` |
| `destroy()` | When the actor or component is removed from the scene |

Components that define `update()` or `fixedUpdate()` are
registered for per-frame updates via the `needUpdate` property.
The default is computed before the subclass constructor body runs,
so a constructor can set `needUpdate = false` to opt out. Setting
it later removes the component from the update loop without
destroying it.

## Destruction

`destroy()` runs once; later calls do nothing. It calls the
protected `onDestroy()` hook, then every teardown registered with
`addTeardown()` in reverse order, then removes the component from
its actor and from the start queue. Override `onDestroy()` rather
than `destroy()` so the bookkeeping cannot be skipped:

```ts
class Spinner extends ActorComponent {
  awake() {
    const onResize = () => this.fit();
    this.actor.world.renderer.on("resize", onResize);
    this.addTeardown(() => this.actor.world.renderer.off("resize", onResize));
  }

  protected override onDestroy(): void {
    this.mesh.geometry.dispose();
  }
}
```

To destroy a component during gameplay, prefer
`world.sceneManager.destroyComponent(component)`, which defers the
destruction to the end of the frame.

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

  /** Returns a prepared asset value synchronously. */
  protected getAsset<TValue>(
    reference: AssetReference<TValue>
  ): TValue;

  isDestroyed(): boolean;

  /** Returns `"$typeName:$id-$persistentId"`. */
  toString(): string;

  /** Runs `teardown` when the component is destroyed. */
  addTeardown(teardown: () => void): void;

  /** Remove the component from its actor. Idempotent. */
  destroy(): void;

  /** Override for component-specific cleanup. */
  protected onDestroy(): void;
}
```

## Declaring component assets

A component can expose one public static group and use the same references in
its lifecycle:

```ts
class PlayerBehavior extends ActorComponent {
  static readonly assets = {
    model: new AssetReference("model.player", AssetTypes.model)
  } satisfies AssetReferenceGroup;

  override awake(): void {
    const model = this.getAsset(PlayerBehavior.assets.model);
  }
}
```

Pass the group to the owning scene with `assets: [PlayerBehavior.assets]`.
This keeps asset loading at the runtime boundary while `awake()`, `start()`,
and `update()` remain synchronous.

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

## See also

- [Behavior](../components/behavior.md)
- [Signal](../components/signal.md)
