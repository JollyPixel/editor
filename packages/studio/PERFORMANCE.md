# @jolly-pixel/studio — performance backlog

Open performance work. Measure an editor open from the double-click to
`data-editor-state="ready"` with `jolly-pixel:debug` set to `*`, against a
baseline worktree with interleaved runs: machine speed drifts too much for
anything else.

Suggested order: shared editor chunks (spike first), mesh workers.

## 1. Render on demand: follow-ups

- voxel-model passes `renderOnDemand: false`. Its async paths (environment
  map load in `ModelEditorScene`, `BlockTextures`, selection and presence
  stores) need auditing before it opts in.
- A gamepad is polled, so its first press after the runtime idles is missed.

## 2. Shared editor chunks

Each page bundles its own three.js, Lit, `@jolly-pixel/ui` and `editor.host`
(eager: about 3.3 MB voxel-map, 2.8 MB voxel-model, 1.5 MB pixel-art). The
workspace resolves one `three@0.186.1` and one `lit@3.3.3`, and no page uses
build plugins, workers, `define` or top-level await, so one multi-page build
is feasible.

Obstacles:

- Separate `public/` folders: each `main.css`, and voxel-map's
  `textures/tileset.png` fetched by relative URL (`src/boot/worldProject.ts`).
- Different roots: pixel-art builds `page/index.html` with
  `vite.page.config.ts`; voxel-map and voxel-model build their package root
  with their default config. The output must keep
  `editors/<name>/index.html`, because frames load `editors/<name>/?target=`.
- The pixel-art page imports `../../src/index.ts` while voxel-map and
  voxel-model import its `dist`, so its code would not be shared until the page
  imports the package root.
- voxel-model sets `esbuild.target: "es2024"`; no other page differs.
- `studio/vite/editorManifest.ts` and the page watcher assume one folder per
  editor.

Plan: spike a studio-owned multi-page config first. Then serve `assets/*` with
`immutable` through servo's `setHeaders` (dev mode forces `no-cache` today),
keeping `index.html`, `main.css` and `textures/` revalidated.

Open decision: this conflicts with external editors (ADR-0016, ADR-0017). Either a
joint build for in-repo editors only, with external editors self-contained, or
an import map that serves three, lit, ui and editor.host once and makes every
editor treat them as external (fits external editors, couples versions).

Related: the eager chunk still carries network `Server`, pino and
ata-validator, pulled in through the network root barrel although only the
offline back-end uses them (see the editors' `modulepreload` list). The page
folders also hold stale chunks from overlapping watch builds: 22 unreachable
files (7.4 MB) in voxel-map's `dist`.

## 3. Shared main thread

Editor frames share the shell's origin, so they run on its main thread.

- **Mesh workers.** One insertion point, `editors/voxel-map/src/scene/EditorScene.ts`
  where `VoxelRenderer` is added: pass `meshing: { workers: { createWorker,
  count } }` with a worker file calling `runMeshWorker(self)` (reference:
  `voxel-renderer/examples/scripts/demo-noise-world.ts`). It needs
  `crossOriginIsolated`: COOP `same-origin` and COEP `require-corp` on the
  studio server, the editor page handler (`studio/vite/editorPagesPlugin.ts`)
  and the editors' own dev servers. No cross-origin resource found that would
  break; detect-gpu is skipped because editors pass `maxFps`. Static hosts
  without headers fall back to main-thread meshing with a warning. Check the
  e2e `optimizeDeps` list with `import.meta.url` workers. voxel-model has no
  VoxelView, so this is voxel-map only. Workers help loads and edits, not
  steady-state rendering.
- **OffscreenCanvas runtime.** Not worth it: the Lit UI mutates the same
  `VoxelWorld` synchronously (`BlockLibrary`, `VoxelLayerPanel`,
  `TemplatePanel`, the inspector panel), input reads layout and pointer lock,
  `GlobalAudio` needs an AudioContext, textures use the DOM `Image` loader.
- **Process isolation.** A different port is the same site, so the frame stays
  in the shell's process; a different site (or `sandbox` without
  `allow-same-origin`) breaks the shared `sessionStorage` identity, the
  offline workspace lock and BroadcastChannel, and changes ADR-0005's WebGL
  context budget. Wait for ROADMAP step 1 (identity in the launch message).
