# Examples

Run them with `npm run dev -w @jolly-pixel/three`, then open the listed root
page.

## Layout

One folder per example, each holding its own `index.html`, `main.ts` and any
asset it alone needs:

```
examples/
├── index.html              landing page, rendered from shared/manifest.ts
├── landing.ts
├── landing.css
├── public/main.css         stylesheet every example page links as /main.css
├── shared/                 code used by two or more examples
├── grid/                   /grid/
├── area-box/               /area-box/
├── translation-controls/   /translation-controls/
├── frustum/                one folder per example, plus family shared code
│   ├── local/              /frustum/local/
│   └── sync/               /frustum/sync/
└── selection/
    ├── shared/
    ├── basic/              /selection/basic/
    ├── peer-sync/          /selection/peer-sync/
    └── stress/             /selection/stress/
```

Folders holding several examples of one component (`frustum`, `selection`) are
not pages themselves.

## Adding an example

1. Create the folder with an `index.html` and a `main.ts`. Copying the closest
   existing example is the fastest start.
2. Add it to `shared/manifest.ts`. The landing page and the "Current" switcher
   in every example's dock both read from it.

`vite.config.ts` collects build inputs by globbing `**/index.html`, so no
build wiring is needed.

## Where code goes

Keep a helper inside the example that uses it. Move it up to the family's
`shared/` folder, or to the root `shared/` folder, only once a second example
imports it.
