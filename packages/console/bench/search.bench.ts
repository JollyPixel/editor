// Import Third-party Dependencies
import {
  defineSuite,
  mulberry32,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import { CommandConsole } from "../src/CommandConsole.ts";
import { classify } from "../src/input/classify.ts";
import { complete } from "../src/search/complete.ts";
import { search } from "../src/search/search.ts";

// CONSTANTS
const kNamespaces = 25;
const kEntriesPerNamespace = 20;
const kWords = [
  "brush",
  "size",
  "mode",
  "axis",
  "pattern",
  "rotation",
  "ghost",
  "layer",
  "tileset",
  "camera",
  "snap",
  "grid",
  "undo",
  "redo",
  "select",
  "fill",
  "export",
  "preview",
  "palette",
  "zoom"
];

const suite = defineSuite("console / search per keystroke (500 entries)", (bench) => {
  const rng = mulberry32();
  const commands = populate(rng);
  const { registry } = commands;

  bench
    .add("search / 1 char", () => search("b", registry).length)
    .add("search / humps", () => search("bs", registry).length)
    .add("search / word", () => search("rotation", registry).length)
    .add("search / miss", () => search("qqqq", registry).length)
    .add("search / typo", () => search("rotatoin", registry).length)
    .add("classify / variable", () => classify("ns12.var3 4", registry).mode)
    .add("complete / after slash", async() => {
      const list = await complete("/ns1", 4, registry);

      return list.items.length;
    })
    .add("complete / typo", async() => {
      const list = await complete("/ns12.cdm3", 10, registry);

      return list.items.length;
    });
});

export default suite;

if (import.meta.main) {
  await runSuites([suite]);
}

function populate(
  rng: () => number
): CommandConsole {
  const commands = new CommandConsole();
  for (let index = 0; index < kNamespaces; index++) {
    const namespace = commands.registerNamespace(`ns${index}`, {
      description: sentence(rng)
    });
    for (let entry = 0; entry < kEntriesPerNamespace / 2; entry++) {
      namespace.registerVariable(`var${entry}${word(rng)}`, {
        type: "number",
        description: sentence(rng),
        get: () => entry,
        set: () => undefined
      });
      namespace.registerCommand(`cmd${entry}${word(rng)}`, {
        description: sentence(rng),
        args: [],
        execute: () => undefined
      });
    }
  }

  return commands;
}

function word(
  rng: () => number
): string {
  return kWords[Math.floor(rng() * kWords.length)];
}

function sentence(
  rng: () => number
): string {
  return Array.from({ length: 5 }, () => word(rng)).join(" ");
}
