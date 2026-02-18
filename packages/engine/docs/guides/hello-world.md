
# Getting Started: Hello World with JollyPixel Engine

## Prerequisites

- Node.js v24 or higher
- [Vite](https://vite.dev/) (for local dev server)
  - [vite-plugin-checker](https://github.com/fi3ework/vite-plugin-checker): provides checks for TypeScript, ESLint, vue-tsc, and Stylelint
  - [vite-plugin-glsl](https://github.com/UstymUkhman/vite-plugin-glsl#readme): import, inline (and minify) GLSL/WGSL shader files
- TypeScript (recommended)
- `@jolly-pixel/engine` and `@jolly-pixel/runtime` packages

## 1. Project Setup

Create a new directory and initialize your project:

```bash
mkdir my-jolly-game
cd my-jolly-game
npm init -y
npm i @jolly-pixel/engine @jolly-pixel/runtime three
npm i -D @types/three typescript vite vite-plugin-checker vite-plugin-glsl
```

Your `package.json` should look like this:

```json
{
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@jolly-pixel/engine": "^1.0.0",
    "@jolly-pixel/runtime": "^1.0.0",
    "three": "0.182.0"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "vite": "^7.3.1",
    "@types/three": "0.182.0",
    "vite-plugin-checker": "0.12.0",
    "vite-plugin-glsl": "1.5.5"
  }
}
```

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
import { Runtime, loadRuntime } from "@jolly-pixel/runtime";

const canvas = document.querySelector("canvas") as HTMLCanvasElement | null;
if (!canvas) {
  throw new Error("HTMLCanvasElement not found");
}

const runtime = new Runtime(canvas, {
  includePerformanceStats: true
});

// Add actors, components, and systems via the runtime API, for example:
// runtime.world.addActor(...);

loadRuntime(runtime).catch(console.error);
```

## 5. Run Your Game

Start the dev server:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser. You should see a blank canvas—your engine is running!

## 6. Next Steps

- Add actors and components to your scene using the engine API.
- Explore our [games](https://github.com/JollyPixel/games) repository for real-world example.
- See the [engine README](../../README.md) and [runtime README](../../../runtime/README.md) for more advanced usage and API details.

---

You now have a working JollyPixel hello world! Continue exploring the docs to build your game.
