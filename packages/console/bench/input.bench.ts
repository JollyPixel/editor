// Import Third-party Dependencies
import {
  defineSuite,
  mulberry32,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import { classify } from "../src/input/classify.ts";
import { tokenize } from "../src/input/tokenize.ts";
import {
  populate,
  sentence
} from "./fixtures.ts";

const suite = defineSuite("console / input lexer", (bench) => {
  const rng = mulberry32();
  const { registry } = populate(rng, {
    namespaces: 25,
    entriesPerNamespace: 20
  });
  const short = "/ns3.cmd2 4 true";
  const long = `/ns3.cmd2 ${sentence(rng, 40)}`;
  const quoted = `/ns3.cmd2 "${sentence(rng, 20)}" "a \\"b\\" c" 'x' 12`;
  const search = `  ${sentence(rng, 4)}  `;

  bench
    .add("tokenize / short command", () => tokenize(short).tokens.length)
    .add("tokenize / 40 words", () => tokenize(long).tokens.length)
    .add("tokenize / quoted", () => tokenize(quoted).tokens.length)
    .add("classify / command", () => classify(short, registry).mode)
    .add("classify / search", () => classify(search, registry).mode);
});

export default suite;

if (import.meta.main) {
  await runSuites([suite]);
}
