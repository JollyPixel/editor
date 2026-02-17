
# Getting Started: Hello World with JollyPixel Engine

## Prerequisites

- Node.js v24 or higher
- [Vite](https://vite.dev/) (for local dev server)
- TypeScript (recommended)
- `@jolly-pixel/engine` and `@jolly-pixel/runtime` packages

## 1. Project Setup

Create a new directory and initialize your project:

```bash
mkdir my-jolly-game && cd my-jolly-game
npm init -y
npm install @jolly-pixel/engine @jolly-pixel/runtime vite typescript --save
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
    "@jolly-pixel/runtime": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "vite": "^7.3.1"
  }
}
```

## 2. Vite Configuration (optional)

Create a minimal `vite.config.js`:

```js
export default {
  root: '.',
};
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
import { Player, loadPlayer } from "@jolly-pixel/runtime";

const canvas = document.querySelector("canvas")!;

const player = new Player(canvas, {
  includePerformanceStats: true
});

const { world } = player;

// You can now add actors, components, etc. to your scene here

loadPlayer(player)
  .catch(console.error);
```

## 5. Run Your Game

Start the dev server:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser. You should see a blank canvas—your engine is running!

## 6. Next Steps

- Add actors and components to your scene using the engine API.
- See the [engine README](../../README.md) and [runtime README](../../../runtime/README.md) for more advanced usage and API details.

---

You now have a working JollyPixel hello world! Continue exploring the docs to build your game.
