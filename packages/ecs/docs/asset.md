# Assets

Scenes declare the assets they need, `SceneManager` loads them through the
world's `AssetCoordinator` before the scene starts, and components read them
synchronously. The asset types and loaders come from the backend; ECS only
owns `ENVIRONMENT_ASSET` and `SCRIPT_MODULE_ASSET`.

## Declaring scene assets

Create references from stable IDs and asset types, then pass them to the
scene constructor:

```ts
import {
  AssetReference,
  AssetType,
  type AssetReferenceGroup
} from "@jolly-pixel/asset";
import {
  ActorComponent,
  Systems
} from "@jolly-pixel/ecs";

const LevelType = new AssetType<LevelData>("level");

class LevelBehavior extends ActorComponent {
  static readonly assets = {
    level: new AssetReference("level.castle", LevelType)
  } satisfies AssetReferenceGroup;

  override awake(): void {
    const level = this.resolveAsset(LevelBehavior.assets.level);
    // Use the loaded value synchronously.
  }
}

class BattleScene extends Systems.Scene {
  constructor() {
    super("battle", {
      assets: [LevelBehavior.assets]
    });
  }
}
```

`SceneOptions.assets` accepts references and reference groups, flattened
into the scene's `assets`. [SceneManager](systems/scene-manager.md) loads
them before activating the scene. The coordinator needs a loader registered
for each kind.

## Reading a loaded asset

`ActorComponent.resolveAsset(reference)` reads the loaded value synchronously.
A value not loaded yet throws `AssetNotReadyError`; it never starts a load.

Catalogs, references and handles come from `@jolly-pixel/asset`.
