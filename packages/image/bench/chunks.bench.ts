// Import Third-party Dependencies
import {
  batched,
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import {
  hasPngSignature,
  readChunks,
  writePng,
  type PngChunk
} from "../src/png/chunks.ts";
import {
  readHeader,
  writeHeader
} from "../src/png/header.ts";
import { colorModelOf } from "../src/png/pixels.ts";
import {
  colorModel,
  pngOf
} from "./_fixtures.ts";

// CONSTANTS
const kSize = 256;

const suite = defineSuite("png / chunks and header", (bench) => {
  const png = pngOf(kSize, 6);
  const chunks: PngChunk[] = [...readChunks(png)];
  const header = {
    width: kSize,
    height: kSize,
    color: colorModel(6)
  };
  const ihdr = writeHeader(header);
  let sink = 0;

  bench
    .add("hasPngSignature", batched(() => {
      sink ^= Number(hasPngSignature(png));
    }))
    .add(`readChunks / ${chunks.length} chunks`, batched(() => {
      for (const chunk of readChunks(png)) {
        sink ^= chunk.data.length;
      }
    }))
    .add(`writePng / ${chunks.length} chunks`, batched(() => {
      sink ^= writePng(chunks).length;
    }))
    .add("readHeader", batched(() => {
      sink ^= readHeader(ihdr).width;
    }))
    .add("writeHeader", batched(() => {
      sink ^= writeHeader(header).length;
    }))
    .add("colorModelOf", batched(() => {
      sink ^= colorModelOf(6)?.channels ?? 0;
    }));

  return () => {
    if (sink === -1) {
      console.log(sink);
    }
  };
}, { opsPerIteration: "batch" });

export default suite;

if (import.meta.main) {
  await runSuites([suite]);
}
