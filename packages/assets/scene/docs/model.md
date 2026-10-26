# Scene document

`SceneDocument` edits a scene through commands. Everything below is exported from `@jolly-pixel/asset.scene/client`.

```ts
import { SceneDocument } from "@jolly-pixel/asset.scene/client";

const document = new SceneDocument();
const playerId = document.addActor({ name: "Player" });
const lightId = document.addComponent(playerId!, {
  type: "Light",
  data: { kind: "point", intensity: 2 }
});
document.changeComponent(lightId!, { data: { intensity: 3 } });
```

## Properties

```ts
class SceneDocument {
  readonly tree: SceneTreeReader;
}
```

- `tree` reads return copies, except `peekActor(id)` and `peekComponent(id)`, which return the stored entry for a read without a copy. Do not mutate it.
- `tree.ancestorIds(id)` yields an actor's parent id, then that parent's, up to the root. It yields nothing for a root or an unknown id.
- `tree.copySubtree(id)` returns the subtree with new actor and component ids, ready for `addSubtree`. The root is renamed `Name (1)`, or `Name (n + 1)` when it already ends with `(n)`. It returns `[]` for an unknown id.
- `tree.topmostIds(ids)` keeps the listed actors that have no listed ancestor, in tree order. Unknown ids are dropped.

## Methods

Each edit returns `false` (or `null` for an add) when the tree refuses it. Every `beforeId` names the sibling to land before; the entry lands last without it.

### addActor(options): string | null

```ts
interface AddActorOptions {
  id?: string; // random by default
  name: string;
  parentId?: string | null; // null by default
  beforeId?: string;
  visible?: boolean; // true by default
  transform?: Partial<SceneTransformJSON>; // identity fields by default
  components?: readonly SceneComponentJSON[];
}
```

Returns the new actor's id.

### addSubtree(actors, beforeId?): boolean

Adds actors in tree order, for a paste or a duplicate. The first one is the root; every other one must have its parent earlier in `actors`.

### remove(id): boolean

Removes the actor and its subtree.

### move(id, parentId, { transform, beforeId? }): boolean

Reparents or reorders the actor. `transform` is its transform under the new parent, so the caller decides whether the world pose stays.

### rename(id, name), changeVisibility(id, visible), transform(id, patch): boolean

`transform` replaces only the fields in `patch` (`position`, `rotation`, `scale`).

### addComponent(actorId, options): string | null

```ts
interface AddComponentOptions {
  id?: string;
  type: string;
  data?: JSONObject;
  assets?: Record<string, AssetReferenceJSON | null>;
  beforeId?: string;
}
```

### removeComponent(id), moveComponent(id, beforeId?): boolean

### changeComponent(id, { data?, unset? }): boolean

Merges the top-level fields of `data` and removes the `unset` ones. A nested value is replaced whole.

### changeComponentAssets(id, assets): boolean

Fills or clears (`null`) the named slots.

### changeEnvironment(patch): boolean

Replaces the named fields of `background`, `environment` and `fog`.

## randomId(): string

Returns a 12-character id from `[0-9A-Za-z]`, the form every actor and component id takes.

## switchFogKind(fog, kind): SceneFogJSON

Returns the default fog of `kind`, keeping the color when both kinds have one. Returns `fog` unchanged when it already has that kind.

## Tree rules

The tree refuses:

- an actor or component id that already exists;
- a parent that does not exist, or a move under the actor's own subtree;
- a `beforeId` that is not a sibling (for an undo, `placeable()` drops it instead);
- an actor with a `prefab`;
- component data over `COMPONENT_DATA_MAX_LENGTH`;
- a component change that names no field, or sets and unsets the same one.

## History

`sceneHistoryRegistration(document, { scope, id? })` registers the document in a `CommandHistory` from `@jolly-pixel/history`; `id` is `"scene"` by default.

```ts
import { CommandHistory } from "@jolly-pixel/history";
import { sceneHistoryRegistration } from "@jolly-pixel/asset.scene/client";

const history = new CommandHistory<"scene">();
history.register(sceneHistoryRegistration(synced.document, { scope: "scene" }));
```

- Every command has an inverse. An undone removal puts the subtree or the component back before its former next sibling.
- A step is refused when a peer has since written one of the values its undo writes back, or changed the subtree an undo would remove.
- A peer editing another field of the same component leaves the step undoable.
- Undoing the fill of a slot the component did not list leaves the slot `null`.
- `sceneHistoryKeys(tree)` returns the registration's keys, for a custom registration.
