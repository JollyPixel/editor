# ECS architecture

`@jolly-pixel/ecs` holds the game model: actors, components, scenes and the
world loop. It never draws. A backend implements two ports to put the world on
screen.

## World and backend ports

```mermaid
flowchart TB
    World["World"] --> Scenes["SceneManager"]
    World --> Renderer["Renderer port"]
    Scenes --> Graph["SceneGraph port"]
    subgraph Backend["Backend: backend.three or headless"]
        direction LR
        ThreeRenderer["ThreeRenderer"]
        ThreeGraph["ThreeSceneGraph"]
    end
    Renderer -.-> ThreeRenderer
    Graph -.-> ThreeGraph
```

- A backend types `actor.node`, `sceneManager.graph` and `world.audio` by
  augmenting the top-level `SceneBackend` interface.
- `HeadlessRenderer` and `HeadlessSceneGraph` run a world without a GPU.

Code: `src/systems/`, `src/systems/rendering/`, `src/systems/scene/`.

## Actor

```mermaid
flowchart TB
    Actor["Actor"] --> Transform["Transform<br/>source of truth for the pose"]
    Actor --> Components["ActorComponent list<br/>Behavior and backend components"]
    Actor --> Node["ActorNode<br/>made by the scene graph"]
    Transform -->|"pushes each change"| Node
```

- Math runs on `@jolly-pixel/math` tuples; the API takes `{ x, y, z }` objects.
- A pose written on the node is overwritten by the next transform change.

Code: `src/actor/`, `src/components/script/`.

## One frame

```mermaid
flowchart TB
    Begin["sceneManager.beginFrame()<br/>activate loads, awake and start"] --> Fixed["fixedUpdate × schedule.steps"]
    Fixed --> Update["update(deltaTime, alpha)<br/>drawn frames only"]
    Update --> Draw["renderer.draw(graph)"]
    Draw --> End["sceneManager.endFrame()<br/>destroy pending"]
```

- The world has no accumulator: a runtime's `GameLoop` hands it the schedule.
- Only actors holding a started component with `needUpdate` are visited.

## Scene loading

```mermaid
flowchart TB
    Load["loadScene(scene)"] --> Batch["AssetCoordinator batch<br/>scene.assets"]
    Batch --> Ready["SceneLoad ready"]
    Ready --> Gate{"activation allowed?"}
    Gate -->|"yes"| Active["Active on the next beginFrame()"]
```

`load.done` resolves before the scene's `awake()` runs.

## Scene files

```mermaid
flowchart TB
    File["SceneFile JSON"] --> Play["FileScene<br/>play mode"]
    File --> Edit["Editor document<br/>edit mode"]
    Play --> Instance["SceneInstance"]
    Edit --> Instance
    Definitions["ComponentDefinitions<br/>ScriptDefinition and backend definitions"] --> Instance
    Instance --> Actors["Live actors and components"]
```

- In edit mode a definition builds nothing that runs the game.
- Prefab instances expand another scene file under an actor, with overrides.
- Component packages contribute definitions and asset loaders by name.

Code: `src/systems/scene/file/`, `src/systems/contributions/`.

See the [glossary](./GLOSSARY.md) and the [API](./README.md#-api).
