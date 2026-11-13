---
name: jollypixel-golem
description: Edit assets in a running JollyPixel studio as a live peer, through the jollypixel MCP tools or a Node script on the @jolly-pixel/golem SDK. Use when asked to build or change a scene or another studio asset.
---

# Working in a JollyPixel studio

You join the studio the way a person does. People with the asset open see your name, a "via golem" badge, the actor you last touched and the activity you publish, and they watch your edits land. You act with the role of the person who created your agent token: if they can only read an asset, so can you.

## The model

- The **catalog** lists every asset: an id, a kind (`scene`, `script`, …) and a path such as `levels/forest.scene.json`. Tools and scripts always name assets by id.
- Each asset has a **room**. Opening an asset joins it. A person in the same editor sees you there.
- An asset changes only through **commands** of its kind. A scene command looks like `{ "action": "actor-renamed", "id": "<actor id>", "name": "Player" }`. The JSON Schema of every command is in `jollypixel://schemas/<kind>`.
- The studio checks each command against the asset as it is now. It **refuses** a command that conflicts with a change a person just made, and **denies** one your role may not send. Either way the edit is not there: never report it as done.
- There is no undo for your edits. Tag the asset first and restore the tag if the run goes wrong.

## Tools or a script

Use the tools for reading and for a few edits: renaming, moving an actor, adding a handful of actors.

Write a script for anything procedural or long: a level layout, scattering props with noise, a grid of tiles, more than a few hundred commands, or more than a handful of the same tool call. A script makes the same edits as the tools, shows up under the same name, and can loop and compute.

### Tools

1. `catalog_list` to find the asset, `asset_open` to join it. `asset_open` names the schema resource to read before writing commands.
2. `asset_read` returns the document. Big documents are truncated; read those from a script.
3. `catalog_tag` before a bulk edit. A name is used once per asset: add the date, such as `before-forest-2026-11-12`.
4. `asset_apply` with related commands in one batch, at most 500. It answers once the studio has accepted all of them, or with the refusal or denial. Kinds have shorter tools for common edits: `scene_add_actors`, `scene_transform_actors`, `scene_move_actors`, `scene_remove_actors`, `scene_add_components` for scenes; `text_read`, `text_replace`, `text_write` for scripts, shaders and texts; `voxelmap_summary`, `voxelmap_query`, `voxelmap_heightmap`, `voxelmap_add_layer`, `voxelmap_fill_box`, `voxelmap_clear_box` for voxel maps; `voxelmodel_add_materials`, `voxelmodel_add_blocks` for voxel models; `pixelart_read_pixels`, `pixelart_paint`, `pixelart_fill_rect`, `pixelart_replace_palette` for pixel art.
5. `presence_activity` with a short label while you work, and `presence_clear` when you are done.
6. `catalog_restore` with the tag when the result is wrong.

`catalog_preview` returns the image the studio shows for an asset, when its kind has one. You cannot see the 3D view: check positions and sizes by reading the document back.

### Scripts

Write the script in the folder `script_run` names (`packages/golem/local/` of the JollyPixel checkout, ignored by git), then run it with `script_run({ script: "forest.ts", args? })`. It runs with Node 24, which runs TypeScript directly, and with `JOLLY_STUDIO_URL` and `JOLLY_GOLEM_TOKEN` set to the MCP server's own, so the script shows up under your name. Your shell does not have the token: run scripts through `script_run`. It answers the exit code and the end of stdout and stderr; print what you want to read back. Scripts stop after 2 minutes unless you pass a longer `timeoutMs`.

`skill/examples/sceneLayout.ts` is a template:

- `Golem.connect()`, then `golem.catalog.tag(assetId, name)`.
- `golem.open(assetId, "scene")` returns a `SceneAsset`; `scene.tree` reads actors and components, `scene.addActors(specs)` adds actors.
- `scene.apply(commands)` takes up to 500 commands and waits while 1,000 are unanswered, so loop over batches freely.
- `await scene.settled()` before reporting success. It rejects with `CommandRefusedError` or `CommandDeniedError`.
- `golem.activity(scene, { label, progress })` to show progress; `golem.clearActivity()` at the end.
- `golem.chat.say(text)` and `await golem.chat.next({ timeoutMs })` to talk with people.
- `using golem = …` disconnects when the script ends.

## Scenes

A scene is a tree of actors. Each actor has an `id`, a `name`, a `parentId` (`null` at the root), `visible`, a `transform` and `components`.

- y is up, rotations are Euler angles in degrees, scale is a factor.
- Add actors with `scene_add_actors`, or `scene.addActors(specs, { parentId })` in a script. A spec needs only a `name`; `transform` fields, `visible`, `components` (`{ type, data?, assets? }`) and nested `children` are optional. It answers the new ids, parents before children:

```json
{
  "assetId": "…",
  "actors": [{
    "name": "Tower",
    "transform": { "position": { "x": 4, "y": 0, "z": -2 } },
    "children": [{ "name": "Roof", "transform": { "position": { "x": 0, "y": 6, "z": 0 } } }]
  }]
}
```

- The `scene_*` tools name actors by name or id. When several actors share a name, the error lists their ids: retry with one. Component asset slots take an asset id or a catalog path, such as `{ "model": "models/tree.obj" }`.
- `scene_transform_actors` changes only the transform fields you give. `scene_move_actors` keeps each actor's transform relative to its new parent, so move first, then transform when the actor should stay in place.
- `scene_remove_actors` removes the actors with their children; `scene_add_components` adds components to one actor. In a script: `transformActors`, `moveActors`, `removeActors`, `addComponents`.

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
- A new scene starts with a "Main Camera", a "Sun" directional light and a "Sky" hemisphere light.

### Scene components

The golem refuses a type, a slot or an asset kind that the studio's editors do not declare, and the error lists the types the studio has. These are the first-party ones:

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

## Scripts, shaders and texts

`script` (`.ts`), `shader` (`.tsl.ts`) and `text` (`.md`) assets are plain text that people edit together, each with a caret.

- Read with `text_read`; pass `from` and `to` (lines from 1) for a long file.
- Change a part with `text_replace`. `search` is matched exactly, whitespace and line breaks included, and must appear once: when it is not unique, add the lines around it rather than setting `all`, unless you mean every occurrence.
- Use `text_write` to write a new file or rewrite most of one. It sends only what changed.
- A person may be typing in the same file. When a replace fails to find its text, read the file again before retrying.
- In a script, `golem.open(assetId, "script")` returns a `TextAsset` with `text`, `read(range)`, `replace(search, replacement, { all })` and `write(text)`.

## Voxel maps and blocksets

A `voxelmap` is a grid of cells in layers. Each cell holds a block from one of the map's blocksets. A new map comes with an empty `default` blockset and no layer.

- Start with `voxelmap_summary`: layers with their bounds, blocksets and the blocks you can place. Positions are whole cells, y is up, and a box `{ min, max }` includes both corners.
- Define blocks on a blockset with `asset_apply` on the blockset asset: `{ "action": "block-defined", "block": { "id": 1, "name": "stone", "shapeId": "cube", "faceTextures": { "top": [1, 0] }, "defaultTexture": [0, 0], "collidable": true, "properties": {} } }`. Ids are local to the blockset.
- A blockset's texture is a grid of square tiles, `tileSize` pixels wide (`asset_read` on the blockset). A tile `[col, row]` covers x `col * tileSize`, y `row * tileSize`. `faceTextures` names a tile per face slot (`right`, `left`, `top`, `bottom`, `front`, `back`); the other faces use `defaultTexture`. Paint the tiles with the `pixelart_*` tools on the blockset's id.
- Other block fields: `collidable` (default true), `alphaMode` (`opaque`, `mask` or `blend`), `alphaCutoff` (0 to 1, for `mask`), `side` (`front` or `double`), `cullCoveredFaces`, `blendGroup` (the group whose rules fade its top and bottom into neighbours), `materialGroup` and free-form `properties`.
- Light comes from a material group, not from the block: define one with `{ "action": "material-group-defined", "group": { "id": "lava", "emissive": "#ff6600", "emissiveIntensity": 2, "lightLevel": 12 } }` (`roughness` and `metalness` 0 to 1, `normalScale`, `lightLevel` 0 to 15), then set the block's `materialGroup` to `"lava"`.
- Add a layer with `voxelmap_add_layer`, on top or `above` another. Use the name or id it returns: a taken name gets a number appended.
- `voxelmap_fill_box` and `voxelmap_clear_box` write a box on one layer. Name blocks as `voxelmap_summary` lists them; use `"<blockset>/<name>"` when two blocksets share a name.
- Check the result with `voxelmap_heightmap` (the top of each column) or `voxelmap_query` (cells of a small box). You cannot see the map.
- For terrain, caves or anything shaped by a formula, write a script: `golem.open(assetId, "voxelmap")` returns a `VoxelMapAsset` with `fillBox`, `clearBox` and `writeVoxels`. `skill/examples/voxelMapTerrain.ts` raises a terrain from a height formula.

## Voxel models

A `voxelmodel` is a small model built from blocks: boxes, planes, cylinders, cones and tori, each with a transform, a material and a UV net on the model's texture. Blocks and folders form a tree; a child block moves with its parent.

- Read it with `asset_read`: `nodes` (folders and blocks) and `materials`.
- Add materials with `voxelmodel_add_materials` (`color`, `opacity`, `roughness`, `metalness`, `emissive`, `emissiveIntensity`), then blocks with `voxelmodel_add_blocks`. Blocks name their material by name. A block's `position` is its centre, relative to its parent node, and rotation turns it around that point; `transform.size` is in voxels and y is up.
- A person moving a block or editing a material field holds a lock on it. Your edit of it then fails with the person's name: wait, or ask them in the chat.
- The model's texture is a `pixelart` asset created next to it: paint it with the `pixelart_*` tools. `voxelmodel_add_blocks` gives each new block its own net on the texture, growing the texture when it is full, and answers the net's `uv` rect: paint the block's faces inside it. A box net is 2 by 3 cells of 16 pixels, one cell per face; the block's `uv` in `asset_read` on the model says which face each cell holds.
- In a script, `golem.open(assetId, "voxelmodel")` returns a `VoxelModelAsset` with `addBlocks`, `addMaterials` and `tree`.

## Pixel art

A `pixelart` asset is a texture people paint pixel by pixel; voxel models and blocksets draw from one. x grows to the right and y downwards, from 0.

- `asset_read` gives its size, palette and UV regions; `pixelart_read_pixels` reads a rect of up to 4,096 pixels.
- Paint with `pixelart_fill_rect` and `pixelart_paint`; colors are `"#rrggbb"` or `"#rrggbbaa"`, alpha `00` being transparent. `pixelart_replace_palette` changes the colors the editor offers, not the pixels.
- The `pixelart_*` tools also paint a blockset's texture: pass the blockset's id.
- For a pattern, a gradient or anything computed, write a script: `golem.open(assetId, "pixelart")` returns a `PixelArtAsset`, and `golem.open(assetId, "blockset")` a `BlocksetAsset`; both have `pixels` with `readPixels`, `paintPixels`, `fillRect` and `replacePalette`.

## Etiquette

- People write to you in the golem chat. Say what you start with `chat_say`, call `chat_next` between steps and before saying you are done, and answer what they ask.
- Publish an activity for anything that takes more than a few seconds.
- Work in batches a person can follow; do not rewrite a whole scene when three actors change.
- When a command is refused, read the asset again: a person probably changed the same thing. Adapt instead of sending it again unchanged.
- Package documentation is in `jollypixel://docs/<package>/<file>`, for example `jollypixel://docs/golem/Golem.md`.
