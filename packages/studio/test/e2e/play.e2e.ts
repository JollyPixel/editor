// Import Internal Dependencies
import {
  test,
  expect
} from "./fixtures.ts";
import {
  GameSeed,
  PlayerWindow
} from "./support/game.ts";

// CONSTANTS
const kPing = `import { Behavior } from "@jolly-pixel/ecs";
import { pong } from "./pong";

export function ping(): string {
  return "ping";
}

export class Ping extends Behavior {
  awake(): void {
    document.title = \`\${ping()} \${pong()}\`;
  }
}
`;
const kPong = `import { ping } from "./ping.js";

export function pong(): string {
  return \`pong after \${ping()}\`;
}
`;

test("plays a scene whose scripts import each other by value", async({
  account,
  page,
  baseURL
}) => {
  using seed = await GameSeed.connect(page.request, baseURL ?? "");
  const ping = await seed.create(`${account}/scripts/ping.ts`, kPing);
  await seed.create(`${account}/scripts/pong.ts`, kPong);
  const scene = await seed.createScene(`${account}/arena.scene.json`, {
    scriptId: ping,
    behavior: "Ping"
  });
  const player = new PlayerWindow(page);

  await player.play(scene);

  await expect(page).toHaveTitle("ping pong after ping");
  await expect(player.error).toBeHidden();
});
