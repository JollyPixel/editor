A scene is a tree of actors. Each actor has an `id`, a `name`, a `parentId` (`null` at the root), `visible`, a `transform` and `components`.

- y is up, rotations are Euler angles in degrees, scale is a factor.
- Add actors with the `addActors` intent, or `scene.addActors({ parentId, actors })` in a script, which takes the intent's input. A spec needs only a `name`; `transform` fields, `visible`, `components` (`{ type, data?, assets? }`) and nested `children` are optional. It answers the new ids, parents before children:

```json
{
  "actors": [{
    "name": "Tower",
    "transform": { "position": { "x": 4, "y": 0, "z": -2 } },
    "children": [{ "name": "Roof", "transform": { "position": { "x": 0, "y": 6, "z": 0 } } }]
  }]
}
```

- The intents name actors by name or id. When several actors share a name, the error lists their ids: retry with one. Component asset slots take an asset id or a catalog path, such as `{ "model": "models/tree.obj" }`.
- `transformActors` changes only the transform fields you give. `moveActors` keeps each actor's transform relative to its new parent, so move first, then transform when the actor should stay in place.
- `removeActors` removes the actors with their children; `addComponents` adds components to one actor. The script methods have the same names.
- `useEnvironment` points the scene at an `environment` asset, by id or path; `null` goes back to the default environment.

- With raw commands you choose the ids of new actors and components: use `crypto.randomUUID()`.
- `actor-added` adds one actor with its descendants. The first actor in `actors` goes under an existing `parentId` (or the root); each later one must name a parent listed before it. Add several root actors with one command each. Every transform field is required:

```json
{
  "action": "actor-added",
  "actors": [{
    "id": "4b1c…",
    "name": "Tree",
    "parentId": null,
    "visible": true,
    "transform": {
      "position": { "x": 4, "y": 0, "z": -2 },
      "rotation": { "x": 0, "y": 35, "z": 0 },
      "scale": { "x": 1, "y": 1, "z": 1 }
    },
    "components": []
  }]
}
```

- `actor-transformed` takes only the transform fields that change: `{ "action": "actor-transformed", "id": "…", "transform": { "position": { "x": 0, "y": 1, "z": 0 } } }`.
- A component has an `id`, a `type`, `data` and `assets`, which maps a slot to `{ "id": <asset id>, "kind": <kind> }`.
- A new scene starts with a "Main Camera", a "Sun" directional light and a "Sky" hemisphere light. Its sky, fog and overall light come from its environment, an `environment` asset: `asset_open` on one gives its guide.

## Scene components

The golem refuses a type, a slot or an asset kind that the studio's kind packages do not declare, and the error lists the types the studio has. These are the first-party ones:

| Type | Asset slots | Draws |
|---|---|---|
| `Mesh` | `shader` (optional) | a primitive shape: floors, walls, props |
| `Model` | `model` (an imported OBJ, FBX or glTF), `shader` | an imported model |
| `VoxelModel` | `model` (a `voxelmodel`) | a voxel model |
| `VoxelMap` | `map` (a `voxelmap`) | a voxel map |
| `Text` | `font` (optional) | 3D text |
| `Camera` | | a camera |
| `Light` | | a light: `kind` is `directional`, `point`, `spot`, `hemisphere` or `ambient` |
| `Script` | `script` | a behavior written in a `script` asset |
| `RigidBody` | | physics for the actor |

A `Mesh` takes `geometry` and `material`. Missing fields keep their default: a 1×1×1 white box.

```json
{
  "type": "Mesh",
  "data": {
    "geometry": { "kind": "box", "width": 20, "height": 0.2, "depth": 20 },
    "material": { "color": "#6b8f4e", "roughness": 0.9 },
    "receiveShadow": true
  }
}
```

`geometry.kind` is `box` (`width`, `height`, `depth`), `sphere` (`radius`), `plane` (`width`, `height`), `cylinder` (`radiusTop`, `radiusBottom`, `height`), `cone`, `torus` or `capsule`. A shape is centred on its actor, so a box of height 4 standing on the floor sits at y 2. The full data of each type is in `jollypixel://docs/engine/systems/scene-file.md` and the pages it links, such as `jollypixel://docs/engine/components/renderers.md` and `jollypixel://docs/engine/components/light.md`.
