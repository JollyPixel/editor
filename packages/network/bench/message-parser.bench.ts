// Import Third-party Dependencies
import {
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import {
  benchProtocols,
  snapshotOf,
  strokeCommand
} from "./_fixtures.ts";
import { MessageParser } from "../src/protocol/message/MessageParser.ts";

// CONSTANTS
const kVariantCounts = [1, 10, 30];
const kSnapshotBytes = 256 * 1024;

const suite = defineSuite("network / MessageParser", (bench) => {
  const sink: unknown[] = [];

  for (const variants of kVariantCounts) {
    const { inbound, outbound } = benchProtocols(variants);
    const inboundParser = MessageParser.of(inbound);
    const outboundParser = MessageParser.of(outbound);
    const command = strokeCommand(variants - 1);
    const broadcast = {
      type: "command",
      data: command,
      version: 1
    };

    bench
      .add(`inbound command [${variants} variants]`, () => {
        sink[0] = inboundParser.parse(command);
      })
      .add(`outbound command [${variants} variants]`, () => {
        sink[0] = outboundParser.parse(broadcast);
      });
  }

  const { outbound } = benchProtocols(10);
  const outboundParser = MessageParser.of(outbound);
  const snapshot = {
    type: "snapshot",
    data: snapshotOf(kSnapshotBytes),
    version: 1
  };
  bench.add("outbound 256 KB snapshot [10 variants]", () => {
    sink[0] = outboundParser.parse(snapshot);
  });

  return () => {
    sink.length = 0;
  };
});

export default suite;

if (import.meta.main) {
  await runSuites([suite]);
}
