## 📌 About

Private editor workspace for the `texture` asset kind that `@jolly-pixel/asset-server` registers for every project, booted through `@jolly-pixel/editor.host`. It shows a `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif` or `.bmp` image; it never edits pixels.

- The view fits the image when it loads, enlarging small sprites by a whole factor. The wheel or a pinch zooms around the pointer, a drag pans, and a double-click fits again. The toolbar holds Fit, Actual size, the zoom steps and Sharp pixels, which switches between nearest and smooth sampling.
- A checkerboard shows through transparent pixels. Animated GIF and WebP files play.
- The Texture pane holds the file actions and the format, dimensions and file size.
- A `.ktx2` texture has no browser decoder, so the view shows nothing and Details lists the size, mip levels and supercompression read from its header.
- Replace… takes a file of the same format, so the asset path keeps matching its content. Export downloads the stored file.

## 🚀 Running the editor

```bash
$ pnpm install
$ pnpm --filter @jolly-pixel/editor.texture dev
```

The dev server seeds a 16×16 potion sprite under `assets/`; delete that directory to seed it again. Other images are imported through the studio.

`window.textureEditor.preview` exposes the decoded image from the console.

## 🧪 Tests and checks

```bash
$ pnpm --filter @jolly-pixel/editor.texture test
$ pnpm --filter @jolly-pixel/editor.texture typecheck
$ pnpm --filter @jolly-pixel/editor.texture lint
```

## Contributors Guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

## License

MIT

<!-- Reference-style links for DRYness -->

[contributing]: ../../../CONTRIBUTING.md
