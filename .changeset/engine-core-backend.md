---
"@jolly-pixel/engine": major
"@jolly-pixel/runtime": patch
"@jolly-pixel/physics": patch
---

Split the engine into a renderer-agnostic core (`@jolly-pixel/engine/core`) and a three.js backend. Actors no longer own an `object3D`: the engine owns the transform and pushes it to a `SceneGraph` node (`ThreeSceneGraph`, `HeadlessSceneGraph`), typed per backend: `actor.node.object3D` and `world.sceneManager.graph.scene`.
`SceneManager` takes its graph, `getSource()`, `default`, `addChildren`/`removeChildren` and `SceneEnvironment` are gone, and `World` gets its audio from the graph. `RigidBody` reads the engine transform.
