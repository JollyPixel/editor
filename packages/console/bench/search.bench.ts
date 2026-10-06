// Import Third-party Dependencies
import {
  defineSuite,
  mulberry32,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import { classify } from "../src/input/classify.ts";
import { browse } from "../src/search/browse.ts";
import { complete } from "../src/search/complete.ts";
import { search } from "../src/search/search.ts";
import { populate } from "./fixtures.ts";

const suite = defineSuite("console / search per keystroke (500 entries)", (bench) => {
  const commands = populate(mulberry32(), {
    namespaces: 25,
    entriesPerNamespace: 20
  });
  const { registry } = commands;

  bench
    .add("search / 1 char", () => search("b", registry).length)
    .add("search / humps", () => search("bs", registry).length)
    .add("search / word", () => search("rotation", registry).length)
    .add("search / miss", () => search("qqqq", registry).length)
    .add("search / typo", () => search("rotatoin", registry).length)
    .add("browse / empty prompt", () => browse(registry, []).length)
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
