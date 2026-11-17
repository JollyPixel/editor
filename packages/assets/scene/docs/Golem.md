# Golem

`@jolly-pixel/asset.scene/golem` lets a golem open `scene` assets. Its `GOLEM_KINDS` export is what `@jolly-pixel/golem` imports for the kind when the studio lists this package; `golem.open(assetId, "scene")` then returns the class below. Importing the entry adds the kind to the `GolemAssets` interface of `@jolly-pixel/golem.kit`, which types that call.

An agent reaches the same edits through the MCP server: `asset_open` answers the guide in `src/golem/guide.md` and the intents below with their input schema, and `asset_intent` runs one.

## Intents

- `addActors({ parentId?, actors })`: `addActors`, answering `{ actors }`.
- `transformActors({ changes })`, `moveActors({ actors, parent, before? })` and `removeActors({ actors })`: the methods of the same name, answering `{ transformed }`, `{ moved }` or `{ removed }`.
- `addComponents({ actor, components })`: answers `{ components }` with their `{ id, type }`.
- `useEnvironment({ environment })`: an environment id, a catalog path or `null`, answering `{ environment }`.

## `SceneAsset`

The asset for `scene`. Commands are the scene's `SceneCommand`.

### `tree: SceneTreeReader`

The live scene tree: actors, transforms and components. Read actor ids here before editing.

### `read(): SceneSnapshot`

The environment and actors as a scene file stores them.

### `addActors(specs, options?): Promise<AddedActor[]>`

Adds actors with their children and components, then returns `{ id, name }` for each new actor, parents before their children. Await `settled()` before reporting them added.

```ts
const [tower] = await scene.addActors([
  {
    name: "Tower",
    transform: { position: { x: 4, y: 0, z: -2 } },
    components: [{ type: "Light" }],
    children: [{ name: "Roof" }]
  }
], { parentId: null });
await scene.settled();
```

```ts
interface ActorSpec {
  name: string;
  visible?: boolean; // default true
  transform?: Partial<SceneTransformJSON>; // missing fields: position and rotation 0, scale 1
  components?: ComponentSpec[];
  children?: ActorSpec[];
}

interface ComponentSpec {
  type: string;
  data?: SceneComponentJSON["data"]; // default {}
  assets?: Record<string, AssetRef>; // default {}
}

// an asset id, a catalog path such as "models/tree.obj", { id, kind }, or null
type AssetRef = string | { id: string; kind: string; } | null;
```

- Actors and components get ids from `crypto.randomUUID()`.
- `options.parentId` names the actor the specs go under, by name or id; `null`, the default, is the scene root.
- Each top-level spec becomes one `actor-added` command, sent through `apply` in batches of `MAX_BATCH_COMMANDS`.
- Throws `TypeError` and sends nothing when `parentId` is a prefab instance, which cannot hold children.

### `transformActors(changes): Promise<void>`

Sends one `actor-transformed` per `{ actor, transform }`. `transform` holds only the fields that change, relative to the parent.

### `moveActors(actors, options): Promise<void>`

Moves `actors` under `options.parent`, `null` for the root, in the given order: before the child `options.before` names, or after the last child. Each actor keeps its transform, which is relative to its parent, so a moved actor shifts in the world when its new parent is placed elsewhere.

### `removeActors(actors): Promise<void>`

Removes `actors` with their descendants. An actor listed with one of its ancestors is removed once.

### `addComponents(actor, specs): Promise<AddedComponent[]>`

Adds `ComponentSpec` components to `actor` and returns `{ id, type }` for each. Throws `TypeError` for a prefab instance, which takes no components.

### `useEnvironment(ref): Promise<void>`

Points the scene at an environment asset, given by id or catalog path; `null` renders the scene with the `default` preset. An asset of another kind throws `KindMismatchError` and an unknown one `UnknownAssetError`, before anything is sent.

### Actors and assets by name

Every actor argument takes a name or an id.

- A name no actor has, or one several actors share, throws `UnknownEntryError`; `error.candidates` lists the sharing actors' ids with their parent's name.
- An asset slot naming no asset id or catalog path throws `UnknownAssetError`.
- Both are thrown before anything is sent.

### Component checks

The studio stores any component `type`, so `apply` and the intent methods check each added component, and each `component-assets-changed`, against the components the studio's editors declare:

- a type no editor declares throws `UnknownComponentError`; `error.known` lists the declared types;
- a slot the type does not have, or an asset of another kind, throws `ComponentSlotError`.

This entry exports both errors.

Nothing is sent when either is thrown.

### Focus

After each batch, the golem's selection presence (`actor`) moves to the last actor the batch touched, so the scene editor shows it the way it shows a person's selection.

## How it works

- `ActorSpec` and `ComponentSpec` are the output types of the zod schemas the `addActors` and `addComponents` intents parse, built from the scene command schemas, so the SDK and the intents take the same input.
- `SceneAsset.guard` checks added components against `SceneComponentTypes`, which parses the scene components each editor declares out of the studio's `project-manifest.json` (`AssetOpening.manifest`, whose editors the kit leaves untyped). The component definitions only load in a browser, so the golem cannot read them.
