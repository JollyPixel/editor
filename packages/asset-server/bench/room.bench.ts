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
  paintCommand
} from "./_fixtures.ts";

// CONSTANTS
const kMemberCounts = [1, 10];
const kCommandCount = 64;

const suite = defineSuite("asset-server / asset room command", async(bench) => {
  const fixture = await benchBackend({
    assets: 100,
    grids: kMemberCounts.length,
    contentBytes: 4_096,
    snapshot: IDLE_SNAPSHOT
  });
  const server = benchServer(fixture.backend);

  for (const [index, count] of kMemberCounts.entries()) {
    const room = gridRoom(gridAssetId(index));
    const peers = Array.from(
      { length: count },
      (_, peer) => connectPeer(server, `peer-${index}-${peer}`)
    );
    for (const peer of peers) {
      await joinRoom(peer, room);
    }

    const commands = Array.from(
      { length: kCommandCount },
      (_, step) => JSON.stringify({
        room,
        kind: "message",
        payload: paintCommand(step + 1)
      })
    );
    const [author] = peers;
    let step = 0;
    bench.add(`paint [${count} members]`, async() => {
      await author.connection.receive(commands[step++ % kCommandCount]);
    });
  }

  return async() => {
    await server.close();
    await fixture[Symbol.asyncDispose]();
  };
});

export default suite;

if (import.meta.main) {
  await runSuites([suite]);
}
