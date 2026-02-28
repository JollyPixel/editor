# Task: Implement UV Mapping System in `pixel-draw-renderer`

## Overview

I want you to create a detailed implementation plan for a full UV mapping system
within the `pixel-draw-renderer` workspace. The goal is to allow users to define,
manage, and edit UV islands on a texture atlas, with real-time updates reflected
on Three.js geometries — similar to how faces are textured in the `voxel-renderer`
workspace (see `src/blocks/shapes/**.ts`).

---

## Context & Architecture

Before planning, please explore and understand the current codebase:

- **`pixel-draw-renderer`**: The main workspace where UV editing will live.
  Understand its current rendering pipeline, canvas management, tools/modes system,
  and how it handles user interaction.
- **`voxel-renderer`** (`src/blocks/shapes/**.ts`): Understand how geometry faces
  are currently UV-mapped (hardcoded or otherwise), and how the texture is consumed
  by Three.js materials. This is the downstream consumer we need to feed into.
- **Blockbench reference** (`uv.js`):
  https://github.com/JannisX11/blockbench/blob/master/js/texturing/uv.js
  Use this as inspiration for UV data modeling, face-UV assignment patterns,
  multi-UV management, and interaction paradigms (not for direct copy-paste).

---

## Features to Plan & Implement

### 1. UV Data Model
- Define a `UV` class or interface: position (`u`, `v`), size (`width`, `height`),
  rotation, and an associated face ID or label.
- Support multiple UVs per texture (UV islands / atlas regions).
- UVs should be serializable (JSON) so they can be saved/restored with the project.
- Consider a `UVMap` registry that holds all UVs for a given texture.

### 2. UV Editing Mode
- Introduce a new distinct **UV Edit Mode** (separate from draw/erase/select modes)
  that can be toggled from the toolbar or via a keyboard shortcut.
- In UV Edit Mode, the canvas overlays UV regions as colored, semi-transparent
  rectangles with handles.
- The user should be able to:
  - **Add** a new UV island (click + drag to define bounds).
  - **Select** an existing UV (click to highlight).
  - **Move** a UV (drag selected UV across the texture surface).
  - **Resize** a UV (drag corner/edge handles).
  - **Delete** a UV (keyboard shortcut or context menu).
  - **Label/rename** a UV (to match face IDs from voxel-renderer).

### 3. UV Stacking & Face Management
- Allow multiple UVs to be **stacked** (overlapping, sharing the same texture region),
  modeling the concept of multiple geometry faces sharing the same UV space.
- Provide a **stack/unstack** toggle per UV island.
- Display a face panel (sidebar or floating panel) listing all defined UVs/faces,
  inspired by how Blockbench lists cube faces. Each entry should show:
  - Face label (e.g. `top`, `bottom`, `north`, `south`, `east`, `west`)
  - UV coordinates
  - A visibility toggle
  - A "jump to UV" button

### 4. Real-Time Three.js Texture Sync
- When a UV is moved or resized, recompute the UV coordinates for the associated
  face and update the Three.js `BufferGeometry` attribute (`uv`) in real time.
- Ensure the Three.js material texture is flagged `needsUpdate = true` after
  pixel edits that affect a UV region.
- Explore whether this sync should be event-driven (emitting a `uv:changed` event)
  or reactive (MobX/signals/store-based), consistent with the existing architecture.

### 5. Snapping & Grid Alignment
- UVs should snap to the pixel grid by default (configurable).
- Optional snap-to-other-UVs behavior (edge alignment).

### 6. Undo/Redo Support
- All UV operations (add, move, resize, delete) must integrate with the existing
  undo/redo history stack.

### 7. Update the example
- Update the demo in `./examples` so we are able to test everything visually with Three.js

---

## Deliverables Expected in the Plan

1. **File & folder structure** — where new UV-related classes, stores, and components
   should live within the existing project layout.
2. **Class/interface definitions** — outline the key data structures (`UV`, `UVMap`,
   `UVEditTool`, etc.) with their properties and methods.
3. **Mode system integration** — how to hook UV Edit Mode into the existing
   tool/mode architecture without breaking current modes.
4. **Rendering pipeline** — how UV overlays are drawn on the canvas (separate
   overlay canvas, SVG layer, or direct canvas compositing?).
5. **Three.js sync strategy** — the exact mechanism and touch points for keeping
   geometry UVs in sync with edits.
6. **Migration path** — how to convert any existing hardcoded UVs in `voxel-renderer`
   shapes into the new system without breaking current behavior.
7. **Open questions** — flag any architectural ambiguities that need a decision
   before implementation begins.

---

## Constraints & Preferences

- Stay consistent with the existing code style, patterns, and abstractions already
  present in the workspace.
- Prefer incremental, non-breaking changes — the voxel-renderer should keep working
  throughout the migration.
- Performance matters: UV overlay rendering should not degrade canvas frame rate
  during pixel drawing.
