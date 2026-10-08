# Examples

Run them with `pnpm --filter @jolly-pixel/voxel.renderer dev`, then open the
listed root page.

## Layout

One folder per example, each holding its own `index.html`, `main.ts` and any
module it alone needs:

```
examples/
├── index.html          landing page, rendered from shared/manifest.ts
├── landing.ts
├── landing.css
├── public/             /main.css and the UV_cube.png blockset
├── shared/             code used by two or more examples
├── shapes/             /shapes/
├── blockset/           /blockset/
├── transparency/       /transparency/
├── normal-map/         /normal-map/
├── physics/            /physics/
└── noise-world/        /noise-world/
```

Examples import the package as `@jolly-pixel/voxel.renderer`, which Vite and
`tsconfig.json` alias to `src/`, so they only use the public API.

## Adding an example

1. Create the folder with an `index.html` and a `main.ts`. Copying the closest
   existing example is the fastest start.
2. Add it to `shared/manifest.ts`. The landing page and the "Current" switcher
   in every example's dock both read from it.

`vite.config.ts` collects build inputs by globbing `**/index.html`, so no
build wiring is needed.

## The page

An `index.html` needs a `<canvas>` and a `<jolly-scope>`; `createExamplePane()`
builds the right-hand `#tools` dock inside that scope on its own.

## The bootstrap

Examples that render a bare `VoxelView` use `shared/OrbitViewer.ts`, which owns
the renderer, scene, orbit camera, screen labels and animation loop:

```ts
const viewer = new OrbitViewer({
  position: { x: 12, y: 18, z: 38 },
  target: { x: 12, y: 3, z: 12 }
});
viewer.scene.add(voxels.root);
viewer.label("glass", { x: 15, y: 7, z: 18 });

await viewer.start({
  onFrame: (deltaTime) => voxels.tick(deltaTime)
});
```

`start()` renders the scene through the camera unless the example passes its
own `render`, which replaces that call. `physics` and `noise-world` run on
`@jolly-pixel/runtime` instead and mount the `VoxelRenderer` component.

## Where code goes

Keep a helper inside the example that uses it. Move it to `shared/` only once
a second example imports it.
