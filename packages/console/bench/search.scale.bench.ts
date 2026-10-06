// Import Third-party Dependencies
import {
  defineSuite,
  mulberry32,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import { search } from "../src/search/search.ts";
import { populate } from "./fixtures.ts";

const suite = defineSuite("console / search per keystroke (5000 entries)", (bench) => {
  const commands = populate(mulberry32(), {
    namespaces: 100,
    entriesPerNamespace: 50
  });
  const { registry } = commands;

  bench
    .add("search / 1 char", () => search("b", registry).length)
    .add("search / word", () => search("rotation", registry).length)
    .add("search / miss", () => search("qqqq", registry).length)
    .add("search / typo", () => search("rotatoin", registry).length);
});

export default suite;

if (import.meta.main) {
  await runSuites([suite]);
}
