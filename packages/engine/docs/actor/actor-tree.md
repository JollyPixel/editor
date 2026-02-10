## ActorTree

Hierarchical container that manages a collection of `Actor` nodes. It
provides depth-first traversal, pattern-based lookups (including glob
and path syntax), and lifecycle management (add, remove, destroy).
`Actor` itself extends `ActorTree`, so every actor doubles as a
sub-tree for its own children.

```ts
import { ActorTree } from "@jolly-pixel/engine";

const tree = new ActorTree();

// Iterate over root actors
for (const actor of tree.getRootActors()) {
  console.log(actor.name);
}

// Find a single actor by name
const player = tree.getActor("Player");

// Find a nested actor by path
const weapon = tree.getActor("Player/RightHand/Weapon");

// Find actors by glob pattern
for (const enemy of tree.getActors("Enemy_*")) {
  console.log(enemy.name);
}

// Deep glob — all descendants matching the pattern
for (const mesh of tree.getActors("Player/**/Mesh_*")) {
  console.log(mesh.name);
}

// Walk the full tree depth-first
for (const { actor, parent } of tree.walk()) {
  console.log(actor.name, "parent:", parent?.name ?? "root");
}
```

### Constructor

#### `new ActorTree(options?)`

```ts
type ActorTreeNode = {
  actor: Actor;
  parent?: Actor;
};

interface ActorTreeOptions {
  addCallback?: (actor: Actor) => void;
  removeCallback?: (actor: Actor) => void;
}

new ActorTree(options?: ActorTreeOptions);
```

Creates a new tree. Optional callbacks are invoked whenever an actor
is added to or removed from this tree's direct `children` list.

The `children: Actor[]` property holds the list of direct child
actors managed by this tree.

#### `add(actor)`

Appends `actor` to the `children` list and fires the `addCallback`
(if provided).

#### `remove(actor)`

Removes `actor` from the `children` list and fires the
`removeCallback` (if provided). No-op if the actor is not a direct
child.

#### `getActor(name): Actor | null`

Returns the first actor whose `name` matches exactly. Supports
path syntax with `/` separators to reach nested children
(e.g. `"Player/RightHand/Weapon"`). Returns `null` if no match is
found. Actors pending for destruction are excluded.

#### `getActors(pattern): IterableIterator<Actor>`

Returns an iterator of all actors matching a glob `pattern`
(powered by picomatch). Supports:

- Simple globs — `"Enemy_*"`, `"Mesh_??"`.
- Path globs — `"Player/*/Mesh"`, `"**/Light_*"`.
- Double-star `**` — matches any depth of descendants.

Actors pending for destruction are excluded.

#### `getRootActors(): IterableIterator<Actor>`

Yields the direct children, skipping any that are pending for
destruction.

#### `getAllActors(): IterableIterator<Actor>`

Yields every actor in the tree via a depth-first walk (including
actors pending for destruction).

#### `destroyActor(actor)`

Marks `actor` as pending for destruction. The actual cleanup is
handled by the game systems on the next frame.

#### `destroyAllActors()`

Marks every actor in the tree as pending for destruction.

#### `walk(): IterableIterator<ActorTreeNode>`

Performs a depth-first traversal of the entire tree, yielding
`{ actor, parent }` pairs starting from each root child.

#### `walkFromNode(rootNode): IterableIterator<ActorTreeNode>`

Performs a depth-first traversal starting from `rootNode`'s
children, yielding `{ actor, parent }` pairs.

#### `[Symbol.iterator](): IterableIterator<Actor>`

Makes the tree iterable with `for...of`. Yields direct children,
skipping any that are pending for destruction.

```ts
for (const actor of tree) {
  console.log(actor.name);
}
```

> [!NOTE]
> This is equivalent to getRootActors()
