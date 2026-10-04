# Mesh texturing

The `@jolly-pixel/editor.pixel-art/mesh-texturing` entry point contains the
Three.js adapters for rendering a pixel-art canvas on geometry.

- [`PixelCanvasTexture`](./PixelCanvasTexture.md) mirrors a canvas and optional
  normal map into GPU textures.
- [`UVGeometryBinding`](./UVGeometryBinding.md) projects UV regions onto mesh
  UVs and can follow region edits.
- [`clampUvRegion`](./clampUvRegion.md) constrains sampling to each UV face's
  region to prevent edge bleed.
- [`NormalMapTexture`](./NormalMapTexture.md) wraps a renderer `NormalMap` as a
  Three.js data texture.

Typical setup creates the texture bridge, binds geometry UVs, then enables
region clamping on a compatible mesh material. Dispose the texture bridge and
call `unfollow()` on a binding when the source canvas or UV map is no longer
used.
