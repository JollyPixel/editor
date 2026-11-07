// Import Third-party Dependencies
import {
  batched,
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";
import { CATALOG_ROOM } from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import "../test/setup.ts";
import type { SessionConnection } from "#src/session/SessionConnection.ts";
import type { EditorSession } from "#src/session/EditorSession.ts";
import {
  BenchProject,
  DEPENDENCY_KIND,
  TARGET_KIND,
  benchDocumentKind
} from "./_fixtures.ts";

// CONSTANTS
const kRecords = 1_000;
const kDependencyCounts = [0, 10, 100];
const kKinds = [benchDocumentKind(DEPENDENCY_KIND)];

interface OpenedSession {
  connection: SessionConnection;
  session: EditorSession;
}

const suite = defineSuite("session / catalog change", async(bench) => {
  const opened: OpenedSession[] = [];

  for (const dependencies of kDependencyCounts) {
    const project = new BenchProject({
      records: kRecords,
      dependencies
    });
    const { client, connection } = await project.connect();
    const session = await connection.openSession({
      launch: project.launch,
      kinds: kKinds,
      accepts: TARGET_KIND
    });
    opened.push({
      connection,
      session
    });

    const renames = project.unrelatedRenames();
    let renamed = 0;
    bench
      .add(`unrelated asset saved, ${dependencies} dependencies`, batched(() => {
        renamed ^= 1;
        client.deliver(CATALOG_ROOM, renames[renamed]);
      }))
      .add(`change listeners only, ${dependencies} dependencies`, batched(() => {
        connection.catalog.emit("change");
      }));

    if (dependencies === 10) {
      const [added, removed] = project.dependencyToggle();
      bench.add("dependency added then removed, 10 dependencies", batched(() => {
        client.deliver(CATALOG_ROOM, added);
        client.deliver(CATALOG_ROOM, removed);
      }));
    }
  }

  return () => {
    for (const { connection, session } of opened) {
      session.dispose();
      connection.dispose();
    }
  };
});

export default suite;

if (import.meta.main) {
  await runSuites([suite]);
}
