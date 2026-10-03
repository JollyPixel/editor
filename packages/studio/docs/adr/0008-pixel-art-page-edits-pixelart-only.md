---
status: accepted
---

# The pixel-art page edits `pixelart` assets only

Pixel-art is a library with a host-mounted demo. Its studio page lives in
`packages/editors/pixel-art/page/`, outside `src/`, and the package `vite.config.ts` builds it to
`dist-page/`, so the `tsc` library build and its dependencies stay as they were. The package's
`jollypixel.editor` manifest points the studio at that folder.

The page opens one texture, the target, over its synced document with presence and the stored key
bindings. It has no runtime preview, rotation toggle or demo parameters; importing replaces the
texture, and adding a texture as a new asset stays a dev-server playground feature.

Tilesets are not pixel-art assets: the `tileset` kind holds pixels and blocks, and its pixels are
edited only inside voxel-map. The voxel-map Paint tab has no "open in a tab" action.

## Considered Options

- **Opening tilesets in the pixel-art page.** The page would need to know blocks, or edit half an
  asset while voxel-map edits the other half.
- **The page under `src/`.** It would join the library build and its type surface.

## Consequences

The page's mount is proven by the studio e2e suite, not a happy-dom spec: the panel needs a real
canvas and the boot a real session.
