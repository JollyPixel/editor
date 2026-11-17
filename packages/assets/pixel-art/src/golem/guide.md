A `pixelart` asset is a texture people paint pixel by pixel; voxel models and blocksets draw from one. x grows to the right and y downwards, from 0.

- `asset_read` gives its size, palette and UV regions; the `readPixels` intent reads a rect of up to 4,096 pixels.
- Paint with the `fillRect` and `paint` intents; colors are `"#rrggbb"` or `"#rrggbbaa"`, alpha `00` being transparent. `replacePalette` changes the colors the editor offers, not the pixels.
- A blockset has the same intents for its texture.
- For a pattern, a gradient or anything computed, write a script: `golem.open(assetId, "pixelart")` returns a `PixelArtAsset` whose `pixels` has `readPixels`, `paintPixels`, `fillRect` and `replacePalette`.
