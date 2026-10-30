# ActorTree

A list of child actors with depth-first traversal and name, path and glob
lookups. `Actor` extends `ActorTree`, so every actor is the tree of its own
children.

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

## Constructor

### `new ActorTree(options?)`

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

The callbacks run when an actor joins or leaves `children`, the list of
direct child actors.

### `add(actor)`

Appends `actor` to `children` and calls `addCallback`.

### `remove(actor)`

Removes `actor` from `children` and calls `removeCallback`. No-op if the
actor is not a direct child.

### `getActor(name): Actor | null`

Returns the first actor whose `name` matches exactly, searching the
whole tree depth-first. A name containing `/` is a path anchored at
the root actors (e.g. `"Player/RightHand/Weapon"`), matched segment
by segment with exact names. Returns `null` if no match is found.
Actors pending for destruction are excluded.

### `getActors(pattern): IterableIterator<Actor>`

Returns an iterator of all actors matching a glob `pattern`
(powered by picomatch). Supports:

- Simple globs — `"Enemy_*"`, `"Mesh_??"`.
- Path globs — `"Player/*/Mesh"`, `"**/Light_*"`. Paths are anchored
  at the root actors.
- Double-star `**` — matches zero or more levels, and can be followed
  by further segments (`"**/RightHand/Weapon"`).

Actors pending for destruction are excluded.

### `getRootActors(): IterableIterator<Actor>`

Yields the direct children, skipping any that are pending for
destruction.

### `getAllActors(): IterableIterator<Actor>`

Yields every actor in the tree via a depth-first walk (including
actors pending for destruction).

### `destroyActor(actor)`

Marks `actor` as pending for destruction; it is destroyed at the end of the
frame.

### `destroyAllActors()`

Marks every actor in the tree as pending for destruction.

### `walk(): IterableIterator<ActorTreeNode>`

Performs a depth-first traversal of the entire tree, yielding
`{ actor, parent }` pairs starting from each root child.

### `walkFromNode(rootNode): IterableIterator<ActorTreeNode>`

Performs a depth-first traversal starting from `rootNode`'s
children, yielding `{ actor, parent }` pairs.

### `[Symbol.iterator](): IterableIterator<Actor>`

Makes the tree iterable with `for...of`, like `getRootActors()`.

```ts
for (const actor of tree) {
  console.log(actor.name);
}
```
