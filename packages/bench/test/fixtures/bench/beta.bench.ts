// Import Internal Dependencies
import { defineSuite } from "../../../src/index.ts";

export default defineSuite("fixtures / beta", (bench) => {
  bench.add("noop", () => void 0);
});
