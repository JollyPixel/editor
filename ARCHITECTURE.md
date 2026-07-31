# Architecture

JollyPixel Editor is a monorepo for a collaborative 3D HTML5 game maker. It provides an ECS framework on Three.js, a browser/Electron runtime, editor tools.

## Monorepo Structure

```
packages/
  engine/              @jolly-pixel/engine              – ECS framework on Three.js (public)
  runtime/             @jolly-pixel/runtime              – Browser/Electron runtime (public)
  event-store/         @jolly-pixel/event-store          – Event Sourcing pattern applied to JollyPixel's events (public)
  network/             @jolly-pixel/network              – Shared multiplayer sync wire (public)
  fs-tree/             @jolly-pixel/fs-tree              – Filesystem tree + live sync (public)
  fs-tree-backend/     @jolly-pixel/fs-tree-backend      – fs-tree socket server backend (private)
  resize-handle/       @jolly-pixel/resize-handle        – Resizable pane UI element (public)
  voxel-renderer/      @jolly-pixel/voxel.renderer       – Voxel rendering library (public)
  pixel-draw-renderer/ @jolly-pixel/pixel-draw.renderer  – Pixel-art canvas library (public)
  editors/
    voxel-map/         @jolly-pixel/editor.voxel-map     – Voxel map editor (private)
    voxel-model/       @jolly-pixel/editor.voxel-model   – Low-poly/voxel 3D model editor (private)
```

Library packages (engine, runtime, event-store, network, fs-tree, resize-handle, voxel-renderer, pixel-draw-renderer) compile with `tsc`. Editor/frontend packages (`editors/*`) use Vite.
