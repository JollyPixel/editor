// Import Third-party Dependencies
import {
  batched,
  defineSuite,
  runSuites
} from "@jolly-pixel/bench";
import { CATALOG_ROOM } from "@jolly-pixel/asset-server/client";

// Import Internal Dependencies
import "../test/setup.ts";
import "#src/ui/index.ts";
import { EditorTargets } from "#src/session/EditorTargets.ts";
import { EditorToolbarSources } from "#src/session/EditorToolbarSources.ts";
import {
  BenchProject,
  DEPENDENCY_KIND,
  toolbarArchives
} from "./_fixtures.ts";

// CONSTANTS
const kRecords = 1_000;
const kNavigator = {
  navigate: () => Promise.resolve()
};

const suite = defineSuite("toolbar / EditorTargets", async(bench) => {
  const [{ Lantern }, { MemoryStorageAdapter }] = await Promise.all([
    import("@jolly-pixel/lantern"),
    import("@jolly-pixel/ui")
  ]);
  const project = new BenchProject({
    records: kRecords,
    dependencies: 0
  });
  const { client, connection } = await project.connect();
  const targets = new EditorTargets({
    catalog: connection.catalog,
    accepts: DEPENDENCY_KIND,
    current: project.records[0].id,
    navigator: kNavigator
  });
  const toolbar = document.createElement("jolly-editor-toolbar");
  toolbar.sources = new EditorToolbarSources({
    targets,
    tags: null,
    archives: toolbarArchives(),
    lantern: new Lantern({
      storage: new MemoryStorageAdapter()
    })
  });
  document.body.append(toolbar);
  await toolbar.updateComplete;

  const renames = project.targetRenames();
  let renamed = 0;
  let sink = 0;
  bench
    .add(`iterate sorted, ${kRecords} accepted`, batched(() => {
      for (const record of targets) {
        sink += record.path.length;
      }
    }))
    .add(`unlisted asset saved, ${kRecords} accepted (happy-dom)`, async() => {
      renamed ^= 1;
      client.deliver(CATALOG_ROOM, renames[renamed]);
      await toolbar.updateComplete;
    })
    .add("toolbar repaint, no target change (happy-dom)", async() => {
      toolbar.requestUpdate();
      await toolbar.updateComplete;
    });

  return () => {
    toolbar.remove();
    targets.dispose();
    connection.dispose();
    if (sink < 0) {
      throw new Error("unreachable");
    }
  };
});

export default suite;

if (import.meta.main) {
  await runSuites([suite]);
}
