---
"@jolly-pixel/engine": minor
---

Add `ShadedMaterial.animated`. `MeshRenderer` and `ModelRenderer` keep the world rendering while they hold an animated shader material, so time-based shaders no longer freeze in on-demand worlds.
