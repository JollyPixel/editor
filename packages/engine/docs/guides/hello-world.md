
# Getting Started: Hello World with JollyPixel Engine

## Prerequisites

- Node.js v24 or higher
- [Vite](https://vite.dev/) with `vite-plugin-checker` (TypeScript checks)
  and `vite-plugin-glsl` (shader imports)

## 1. Project Setup

Create a new directory and initialize your project:

```bash
mkdir my-jolly-game
cd my-jolly-game
npm init -y
npm i @jolly-pixel/engine @jolly-pixel/runtime three
npm i -D @types/three typescript vite vite-plugin-checker vite-plugin-glsl
```

Set `"type": "module"` in `package.json` and add a `"dev": "vite"` script.

## 2. Vite Configuration

Create a minimal `vite.config.ts`:

```js
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";
import glsl from "vite-plugin-glsl";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    checker({
      typescript: true
    }),
    glsl()
  ]
});
```

## 3. HTML Entry Point

Create `index.html` in your project root:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JollyPixel Hello World</title>
  <link rel="stylesheet" href="./main.css">
  <link rel="icon" type="image/x-icon" href="/favicon.ico" />
</head>
<body>
  <canvas tabindex="-1"></canvas>
  <script type="module" src="./src/main.ts"></script>
</body>
</html>
```

## 4. TypeScript Entry Point

Create `src/main.ts`:

```ts
import { Runtime } from "@jolly-pixel/runtime";

const runtime = await Runtime.create("canvas", {
  includePerformanceStats: true
});

// Add actors and components, for example:
// runtime.world.createActor("Player").addComponent(...);

runtime.load().catch(console.error);
```

## 5. Run Your Game

Start the dev server:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173): a blank canvas means the
engine is running.

## 6. Next Steps

- Add actors and components: see the [engine README](../../README.md).
- Browse the [games](https://github.com/JollyPixel/games) repository for
  complete examples.
