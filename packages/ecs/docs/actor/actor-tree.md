# ActorTree

A read-only list of child actors with depth-first traversal and name, path
and glob lookups. `world.sceneManager.tree` holds the root actors, and
`Actor` extends `ActorTree`, so every actor is the tree of its own children.
The list changes only through the actor API: creating, reparenting or
destroying an actor.

```ts
const { tree } = world.sceneManager;

// Iterate over root actors
for (const actor of tree) {
  console.log(actor.name);
}

// Find a single actor by name
const player = tree.findActor("Player");

// Find a nested actor by path
const weapon = tree.findActor("Player/RightHand/Weapon");

// Find actors by glob pattern
for (const enemy of tree.findActors("Enemy_*")) {
  console.log(enemy.name);
}

// Deep glob — all descendants matching the pattern
for (const mesh of tree.findActors("Player/**/Mesh_*")) {
  console.log(mesh.name);
}

// Walk the full tree depth-first
for (const { actor, parent } of tree.walk()) {
  console.log(actor.name, "parent:", parent?.name ?? "root");
}
```

## Members

```ts
type ActorTreeNode = {
  actor: Actor;
  parent?: Actor;
};
```

### `children: readonly Actor[]`

The direct child actors, in the order they joined, pending ones included.

### `findActor(name): Actor | null`

Returns the first actor whose `name` matches exactly, searching the
whole tree depth-first. A name containing `/` is a path anchored at
the root actors (e.g. `"Player/RightHand/Weapon"`), matched segment
by segment with exact names. Returns `null` if no match is found.
Actors pending for destruction are excluded.

### `findActors(pattern): IterableIterator<Actor>`

Returns an iterator of all actors matching a glob `pattern`. `*`
matches any run of characters within a name and `?` one character;
every other character, `.` included, matches itself. Supports:

- Simple globs — `"Enemy_*"`, `"Mesh_??"`. A pattern without `/`
  matches names at any depth.
- Path globs — `"Player/*/Mesh"`, `"**/Light_*"`. Paths are anchored
  at the root actors.
- Double-star `**` — matches zero or more levels, and can be followed
  by further segments (`"**/RightHand/Weapon"`).

Actors pending for destruction are excluded.

### `walk(): IterableIterator<ActorTreeNode>`

Performs a depth-first traversal below the tree, yielding `{ actor, parent }`
pairs. `parent` is the actor's parent, or `undefined` for a root actor.
`actor.walk()` walks the descendants of one actor.

### `[Symbol.iterator](): IterableIterator<Actor>`

Yields the direct children, skipping any that are pending for
destruction.

```ts
for (const actor of tree) {
  console.log(actor.name);
}
```
