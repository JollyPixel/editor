# Voxel auto-orientation investigation

Investigated on `main` at `732a30e6`, in branch
`fix/voxel-auto-orientation`. The original investigation and proposed plan
below are retained as background for the implementation. The editor now
applies the shape-aware correction, with a geometry-backed regression test.

## Finding

The editor assumes every shape faces along local `+Z`. In auto mode,
`brushOrientationOf()` aligns that axis with the camera's horizontal viewing
direction. The renderer applies that rotation consistently.

`stairCornerOuter` has its upper quarter at local `-X/-Z`. Its top quad spans
`x = 0..0.5`, `z = 0..0.5`, at `y = 1`. This puts the upper step toward the
camera under the current auto mapping. `stairCornerPeak` has its upper column
in the same quarter and exhibits the same reversal.

The regular stair puts its upper step at `+Z`, so the current auto mapping
already makes it rise away from the camera. Reversing auto rotation for all
blocks would break this behavior.

Evidence comes from:

- `packages/editors/voxel-map/src/features/painting/model/brushOrientation.ts`
- `packages/editors/voxel-map/src/features/painting/LocalBrush.ts`
- `packages/voxel-renderer/src/document/blocks/shape/library/StairCornerOuter.ts`
- `packages/voxel-renderer/src/document/blocks/shape/library/StairCornerPeak.ts`
- `packages/voxel-renderer/src/document/geometry/rotation.ts`

## Shape review

All 34 built-in registrations were inspected through their actual geometry.
The directional shapes need separate treatment from symmetric blocks and
ceiling complements.

| Shape or family | Default layout | Proposed auto change |
|---|---|---|
| `stair`, `ramp` | High end toward `+Z` | Keep current mapping |
| `stairCornerInner`, `rampCornerInner` | High region toward `+X/+Z` | Keep current mapping |
| `stairCornerOuter`, `stairCornerPeak` | High quarter toward `-X/-Z` | Add 180 degrees |
| `rampCornerOuter` | High point at `-X/+Z` | Keep current mapping; opposite handedness deserves a visual check |
| `slabNotch` | Missing quarter at `-X/-Z` | Add the same 180 degrees as its stair complement |
| `slabBeam`, `slabCorner` | Complements of regular and inner stairs when flipped | Keep current mapping |
| `rampTip`, `rampValley` | Ceiling/complement geometry | Keep current mapping |
| Walls and poles | Arms defined by junction type; corners branch toward `+X/+Z` | Keep current mapping |
| Cube, full slabs, symmetric walls/poles | No unique horizontal facing | Keep current mapping |

The confirmed high-step reversal affects the outer stair and peak. The review
does not establish a preferred orientation for every ceiling or junction
shape. In particular, ramp-corner handedness is a separate question from the
reported 180-degree reversal.

## Proposed implementation

1. Make `brushOrientationOf()` accept the selected shape id. Preserve its
   explicit-mode early return and existing vertical-flip behavior. In auto
   mode, add two quarter turns for `stairCornerOuter`, `stairCornerPeak`, and
   `slabNotch`, wrapping to `0..3`. Unknown/custom shape ids retain the existing
   mapping. Keep this policy inside the editor; it does not require a public
   renderer API.
2. Resolve the selected block's `shapeId` from `view.document.blocks` in
   `LocalBrush.#paint()` and pass it to the helper. This shared paint path
   supplies placement, replacement, ghost previews, and merge checks, so the
   correction belongs there.
3. Extend the existing orientation spec with real built-in shapes and
   transformed geometry. Assert that the high-step center projects positively
   along the camera's viewing direction for each cardinal heading. Demonstrate
   that the outer-stair and peak cases fail before the fix.
4. Cover explicit rotations, looking up/down, forced flip, diagonal axis
   selection, and custom/unknown ids in the existing scenario tables. Add a
   geometry-backed complement case proving that auto-oriented outer stairs
   still pair with flipped auto-oriented slab notches. Avoid new test-only
   production exports.

The slab-notch offset keeps the documented complement relationship usable
when both pieces are placed with auto orientation. Without it, correcting
the stair alone would make their default auto transforms differ by 180 degrees.

Renderer geometry should stay stable. Rotating a built-in definition would
change saved maps, collision geometry, texture-slot placement, and complement
relationships at the same stored transform. The editor correction affects
future auto placements only. Manual rotations retain their current meaning.

## Validation

Completed during investigation:

- Executed the actual orientation helper in memory with Three.js cameras,
  built-in face geometry, and the renderer's `rotateVertex()`. For every
  cardinal heading, the regular stair's high-step projection was `+0.25` cell;
  the outer stair and peak were `-0.25`. Applying a half turn changed both
  affected shapes to `+0.25`.
- Ran the renderer's `library.spec.ts` and `complements.spec.ts`: 98 tests
  passed, including outward normals, volume, occlusion, and complements under
  all shared transforms.

Implementation validation should run the focused editor orientation and ghost
specs, then the relevant package tests, `pnpm run typecheck`, and
`pnpm run lint`. Rebuild changed workspaces before validating consumers.
Rebuild the renderer and editor dependencies as needed for their `dist/`
imports. Run `git diff --check`.

Manually compare ghost and placed blocks for all four headings, both vertical
flip states, and explicit rotations. Check outer stair plus slab notch in a
merged cell, and compare stair/ramp corner handedness side by side. A unit
regression can prove the orientation behavior; a new E2E test is unnecessary
unless a separate rendering discrepancy appears.

No browser reproduction, full workspace build, typecheck, or lint was run for
this read-only investigation. The voxel-map editor is private, so an
editor-only fix needs no changeset. If implementation adds package Markdown,
run `pnpm run docs:build`.
