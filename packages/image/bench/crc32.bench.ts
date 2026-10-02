// Import Third-party Dependencies
import {
  defineSuite,
  mulberry32,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import { crc32 } from "../src/png/crc32.ts";

// CONSTANTS
const kSizes = [
  {
    name: "4 KiB",
    bytes: 4096
  },
  {
    name: "64 KiB",
    bytes: 65_536
  },
  {
    name: "1 MiB",
    bytes: 1_048_576
  }
];

const suite = defineSuite("png / crc32", (bench) => {
  const rng = mulberry32();

  for (const { name, bytes } of kSizes) {
    const data = Uint8Array.from({ length: bytes }, () => rng() * 256);

    bench.add(name, () => {
      crc32(data);
    });
  }
});

export default suite;

if (import.meta.main) {
  await runSuites([suite]);
}
