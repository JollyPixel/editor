// Import Third-party Dependencies
import {
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import {
  adaptiveFilter,
  filterScanlines,
  fixedFilter,
  unfilterScanlines,
  FILTER_TYPES
} from "../src/png/filters.ts";
import {
  rgbaImage,
  type Content
} from "./_fixtures.ts";

// CONSTANTS
const kSize = 1024;
const kChannels = 4;
const kContents: Content[] = ["tiles", "noise"];

const suite = defineSuite("png / filters", (bench) => {
  for (const content of kContents) {
    const { data } = rgbaImage(kSize, content);

    bench.add(`filterScanlines / ${content} / adaptive`, () => {
      filterScanlines(data, kSize, kSize, kChannels, adaptiveFilter);
    });
    for (const filter of FILTER_TYPES) {
      const strategy = fixedFilter(filter);
      const filtered = filterScanlines(
        data,
        kSize,
        kSize,
        kChannels,
        strategy
      );

      bench
        .add(`filterScanlines / ${content} / filter ${filter}`, () => {
          filterScanlines(data, kSize, kSize, kChannels, strategy);
        })
        .add(`unfilterScanlines / ${content} / filter ${filter}`, () => {
          unfilterScanlines(filtered, kSize, kSize, kChannels);
        });
    }
  }
});

export default suite;

if (import.meta.main) {
  await runSuites([suite]);
}
