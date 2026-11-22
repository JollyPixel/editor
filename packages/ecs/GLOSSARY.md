# ECS glossary

Each term describes the idea first. The *In code* line names where it shows up
in the API. The [architecture](./ARCHITECTURE.md) shows how the parts fit
together.

## Actors

### Actor

A named node of the scene tree, the *Entity* of other ECS libraries. It has no
rendering or logic of its own: its components add them, and its children move
with it. A **persistent** actor survives scene changes.

*In code:* `Actor`, `ActorTree`, `world.createActor()`.

### Component

One responsibility attached to an actor, with lifecycle hooks (`awake`,
`start`, `fixedUpdate`, `update`, `destroy`). A **behavior** is the component
for game scripts: decorators declare its scene properties, sibling components
and input listeners.

*In code:* `ActorComponent`, `Behavior`, `@SceneProperty`.

### Transform

The actor's pose in local or global space. It is the source of truth: each
change is pushed to the actor's node, never read back from it.

*In code:* `actor.transform`, `Vector3Like`, `QuaternionLike`, `Mat4`.

### Signal

A typed event a component emits and other components connect to, as in Godot.

*In code:* `SignalEvent`, a scene file component's `connections`.

## Backend

### Backend

What puts the world on screen: a renderer and a scene graph that mirrors each
actor into a **node**. `@jolly-pixel/backend.three` is the three.js backend;
the **headless** backend draws nothing.

*In code:* `Renderer`, `SceneGraph`, `ActorNode`, `HeadlessRenderer`,
`HeadlessSceneGraph`.

### Scene backend

The compile-time registration of a backend's types, so `actor.node` or
`world.audio` have the backend's type without a cast. A program uses one
backend.

*In code:* `declare module "@jolly-pixel/ecs" { interface SceneBackend {} }`.

## Scenes

### Scene

A set of actors loaded and replaced as one, with the assets it declares.
A scene **load** is ready once its assets are; it becomes **active** on the
next frame, unless the caller holds its **activation**.

*In code:* `Systems.Scene`, `SceneManager`, `SceneLoad`, `allowActivation()`.

### Scene file

A scene as plain JSON: actors, their components as data, and **prefab**
instances that expand another scene file with overrides. In **play** mode it
builds the game; in **edit** mode it builds only what an editor shows.

*In code:* `SceneFile`, `FileScene`, `SceneInstance`.

### Component definition

How a scene file component type turns its data into a live component and
back. A **component package** contributes definitions and asset loaders from
another workspace.

*In code:* `ComponentDefinition`, `ComponentDefinitions`, `ComponentPackage`.

### Environment

The look a scene renders in: sky, sun, ambient light, reflections, fog, tone
mapping and glow, as one file the backend applies.

*In code:* `EnvironmentFile`, `ENVIRONMENT_PRESETS`, `SceneEnvironment`.
