# backend.three architecture

`@jolly-pixel/backend.three` implements the ECS backend ports with three.js
and adds the components, assets and browser runtime a game needs.

## Ports

```mermaid
flowchart TB
    subgraph ECS["@jolly-pixel/ecs"]
        direction LR
        Renderer["Renderer port"]
        Graph["SceneGraph port"]
    end
    ThreeRenderer["ThreeRenderer<br/>THREE.WebGPURenderer"] -.-> Renderer
    ThreeGraph["ThreeSceneGraph<br/>THREE.Scene"] -.-> Graph
    ThreeGraph --> Node["ThreeActorNode<br/>THREE.Group per actor"]
    ThreeGraph --> Environment["ThreeSceneEnvironment<br/>sky, lights, fog, glow"]
```

- Importing the package registers its types on the ECS `SceneBackend`, so
  `actor.node.object3D` types without a cast.
- Script compilers load the package as ambient `types` for the same reason.

Code: `src/rendering/`, `src/scene/`.

## Drawing a frame

```mermaid
flowchart TB
    Draw["ThreeRenderer.draw(graph)"] --> Resize["Apply the observed canvas size"]
    Resize --> Order["Cameras by ascending depth"]
    Order --> Camera{"camera has post-processing?"}
    Camera -->|"no"| Direct["Render in its viewport"]
    Camera -->|"yes"| Pipeline["RenderPipeline per camera"]
```

- Pipelines compile asynchronously; `compiled` fires when the last settles.
- The scene graph's `postProcessing` applies to cameras that have none.

Code: `src/rendering/compositing/`.

## Components and assets

```mermaid
flowchart TB
    Assets["Asset loaders<br/>model, font, sound, texture, scene, environment"] --> Coordinator["AssetCoordinator"]
    Coordinator --> Components["Renderers, camera, light, audio, UI"]
    Definitions["Scene file definitions"] --> Components
```

- `createDefaultAssetLoaders()` shares one `THREE.LoadingManager`.
- Camera, light, audio, mesh, model and text components have a definition,
  so an ECS `FileScene` can build them.
- `src/components/physics/` is the `./physics` entry, the only code that
  imports the optional `@jolly-pixel/physics` peer. The root entry never
  reaches it; `test/bundle.spec.ts` checks that.

Code: `src/assets/`, `src/components/`, `src/audio/`, `src/ui/`.

## Runtime

```mermaid
flowchart TB
    Create["Runtime.create(canvas)"] --> Catalog["Resolve the asset catalog"]
    Catalog --> Renderer["ThreeRenderer.create()"]
    Renderer --> Backend["ThreeRuntimeBackend<br/>World on a ThreeSceneGraph"]
    Backend --> Core["RuntimeCore<br/>@jolly-pixel/runtime"]
```

- `RuntimeCore` owns the loop, loading screen, overlay and metrics.
- The backend adds the renderer counters, the view helper and the KTX2 loader.

Code: `src/runtime/`.

See the [glossary](./GLOSSARY.md) and the [API](./README.md#-api).
