// Import Third-party Dependencies
import {
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import {
  EXTENSION_NAME,
  GATED_RIGHTS,
  ROOM_NAME,
  EchoExtension,
  SinkHandle,
  cursorPatch,
  identityOf,
  silentLogger,
  strokeCommand
} from "./_fixtures.ts";
import { RightsTable } from "../src/index.ts";
import { ServerRoom } from "../src/server/room/ServerRoom.ts";

// CONSTANTS
const kMemberCounts = [2, 10, 50];
const kVariants = 20;
const kRightsModes = ["open", "gated"] as const;

type RightsMode = typeof kRightsModes[number];

const suite = defineSuite("network / ServerRoom fan-out", async(bench) => {
  const logger = silentLogger();

  for (const rights of kRightsModes) {
    for (const members of kMemberCounts) {
      const room = await joinedRoom(members, rights, logger);
      const command = strokeCommand(kVariants - 1);
      let step = 0;

      bench
        .add(`presence [${members} members, ${rights}]`, () => {
          room.updatePresence("peer-0", cursorPatch(step++));
        })
        .add(`command echo [${members} members, ${rights}]`, async() => {
          await room.message("peer-0", command);
        });
    }
  }
});

export default suite;

async function joinedRoom(
  members: number,
  rights: RightsMode,
  logger: ReturnType<typeof silentLogger>
): Promise<ServerRoom> {
  const table = new RightsTable(
    rights === "gated" ? GATED_RIGHTS : undefined
  );
  const room = new ServerRoom(
    ROOM_NAME,
    new EchoExtension({ variants: kVariants }),
    table.scope(EXTENSION_NAME),
    { logger }
  );

  for (let index = 0; index < members; index++) {
    const clientId = `peer-${index}`;
    await room.join({
      handle: new SinkHandle(clientId),
      identity: identityOf(clientId, index % 4 === 3 ? "viewer" : "editor")
    });
  }

  return room;
}

if (import.meta.main) {
  await runSuites([suite]);
}
