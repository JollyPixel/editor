// Import Internal Dependencies
import { defineSuite } from "../../../src/index.ts";

export default defineSuite("fixtures / alpha", (bench) => {
  bench.add("noop", () => void 0);
});
