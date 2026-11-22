# backend.three glossary

Terms of the three.js backend. Actors, components, scenes and scene files are
ECS terms. The [architecture](./ARCHITECTURE.md) shows how the parts fit
together.

## Rendering

### Render component

A camera the renderer draws, ordered by **depth** (background first) inside
its **viewport**, a part of the canvas. A camera may own a **post-processing**
function that draws it through a render pipeline instead of a direct render.

*In code:* `ThreeRenderComponent`, `CameraComponent`, `PostProcessing`.

### Pipeline compile

The asynchronous build of an object's shaders. Frames keep presenting while
it runs; the object appears on a later frame.

*In code:* `renderer.pendingCompiles`, `renderer.compiled()`,
`runtime.compiledFrame()`.

### Actor node

The `THREE.Group` that mirrors an actor in the scene. Add meshes to it; move
the actor through its transform.

*In code:* `actor.node.object3D`, `ThreeActorNode`, `findActor()`.

### Scene environment

The applied environment file: sun, ambient light, sky, fog, reflections and
glow. The **fallback sky** is what editors draw when the file has none.

*In code:* `ThreeSceneEnvironment`, `BakedRoomEnvironment`.

## Audio

### Sound

A decoded audio buffer with the settings saved in its file. Playing it makes
a **sound instance**; a **category** of the mixer groups instances for
volume, mute and voice limits.

*In code:* `Sound`, `SoundInstance`, `AudioMixer`, `world.audio`.

### Audio zone

A box or sphere around an actor that loops an ambient sound while its target
is inside, or plays a sound when the target enters. The target is the
audio listener by default.

*In code:* `AudioZoneComponent`, `AudioListenerComponent`.

## Runtime

### Runtime

The three.js runtime on a canvas: it builds the renderer and world, then lets
`RuntimeCore` drive them. Its **catalog** lists the project's assets.

*In code:* `Runtime.create()`, `RuntimeAssetOptions`.

### Renderer counters

Draw calls, triangles, geometries, textures and GPU time of the last drawn
frame, registered as metrics.

*In code:* `runtime.metrics.renderer`, `RendererMetrics`.
