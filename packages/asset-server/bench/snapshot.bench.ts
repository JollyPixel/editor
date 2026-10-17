// Import Third-party Dependencies
import {
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import {
  IDLE_SNAPSHOT,
  benchBackend,
  benchServer,
  connectPeer,
  gridAssetId,
  gridRoom,
  joinRoom,
  paintCommand,
  type BenchBackend
} from "./_fixtures.ts";

// CONSTANTS
const kScenarios = [
  { assets: 100, contentBytes: 4_096 },
  { assets: 100, contentBytes: 262_144 },
  { assets: 100, contentBytes: 4_194_304 },
  { assets: 5_000, contentBytes: 4_096 }
];

const suite = defineSuite("asset-server / snapshot write", async(bench) => {
  const fixtures: BenchBackend[] = [];
  const closers: (() => Promise<void>)[] = [];

  for (const { assets, contentBytes } of kScenarios) {
    const fixture = await benchBackend({
      assets,
      grids: 1,
      contentBytes,
      snapshot: IDLE_SNAPSHOT
    });
    fixtures.push(fixture);
    const server = benchServer(fixture.backend);
    closers.push(() => server.close());

    const assetId = gridAssetId(0);
    const room = gridRoom(assetId);
    const author = connectPeer(server, "author");
    await joinRoom(author, room);

    let step = 0;
    bench.add(`paint + flush [${kb(contentBytes)}, ${assets} assets]`, async() => {
      await author.connection.receive(JSON.stringify({
        room,
        kind: "message",
        payload: paintCommand(++step)
      }));
      await fixture.backend.flush(assetId);
    });
  }

  return async() => {
    for (const close of closers) {
      await close();
    }
    for (const fixture of fixtures) {
      await fixture[Symbol.asyncDispose]();
    }
  };
});

export default suite;

function kb(
  bytes: number
): string {
  return `${bytes / 1_024} KB`;
}

if (import.meta.main) {
  await runSuites([suite]);
}
