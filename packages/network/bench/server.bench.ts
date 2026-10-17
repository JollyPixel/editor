// Import Third-party Dependencies
import {
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import {
  ROOM_NAME,
  EchoExtension,
  SinkHandle,
  cursorPatch,
  identityOf,
  silentLogger,
  strokeCommand
} from "./_fixtures.ts";
import {
  Server,
  type ServerConnection
} from "../src/index.ts";

// CONSTANTS
const kMembers = 10;
const kVariants = 20;

const suite = defineSuite("network / Server#receive", async(bench) => {
  const server = new Server({ logger: silentLogger() });
  server.register(new EchoExtension({ variants: kVariants }));

  const connections: ServerConnection[] = [];
  for (let index = 0; index < kMembers; index++) {
    const clientId = `peer-${index}`;
    const connection = server.connect(
      new SinkHandle(clientId),
      identityOf(clientId)
    );
    await connection.receive(JSON.stringify({
      room: ROOM_NAME,
      kind: "join"
    }));
    connections.push(connection);
  }

  const [author] = connections;
  const command = JSON.stringify({
    room: ROOM_NAME,
    kind: "message",
    payload: strokeCommand(kVariants - 1)
  });
  const presence = Array.from({ length: 64 }, (_, step) => JSON.stringify({
    room: ROOM_NAME,
    kind: "presence",
    patch: cursorPatch(step)
  }));
  const malformed = JSON.stringify({
    room: ROOM_NAME,
    kind: "message"
  });
  let step = 0;

  bench
    .add(`presence [${kMembers} members]`, async() => {
      await author.receive(presence[step++ % presence.length]);
    })
    .add(`command echo [${kMembers} members]`, async() => {
      await author.receive(command);
    })
    .add("malformed envelope", async() => {
      await author.receive(malformed);
    });

  return () => server.close();
});

export default suite;

if (import.meta.main) {
  await runSuites([suite]);
}
