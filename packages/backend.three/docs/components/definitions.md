# Scene file definitions

The `ComponentDefinition`s that let an ECS `FileScene` build the components of
this backend. Register the ones a game uses on its `ComponentDefinitions`.

Each one parses a missing field to the component's own default
(`CAMERA_DEFAULTS`, `LIGHT_DEFAULTS`, `MESH_RENDERER_DEFAULTS`), and
captures the live component back to data.

- `CameraDefinition` (`Camera`): the [camera](camera.md) options. In edit
  mode the camera is created with `render: false`.
- `LightDefinition` (`Light`): a [light](light.md).
- `AudioSourceDefinition` (`AudioSource`), `AudioListenerDefinition`
  (`AudioListener`) and `AudioZoneDefinition` (`AudioZone`): the
  [audio components](audio.md). The sound editor contributes them to scenes.
- `MeshDefinition` (`Mesh`): a [mesh renderer](renderers.md#meshdefinition).
- `ModelDefinition` (`Model`) and `TextDefinition` (`Text`): the
  [model](renderers.md#modeldefinition) and [text](renderers.md#textdefinition)
  renderers.
