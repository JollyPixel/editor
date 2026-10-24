// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import {
  Lantern,
  TargetPath,
  Tour
} from "@jolly-pixel/lantern";
import {
  MemoryStorageAdapter,
  type ContextMenu,
  type Select
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import { REPLAY_TOUR_STEP } from "#src/ui/lantern/replayTourStep.ts";
import { EditorToolbarSources } from "#src/session/EditorToolbarSources.ts";
import { ConnectionStatus } from "#src/connection/ConnectionStatus.ts";
import { AssetLeases } from "#src/lease/AssetLeases.ts";
import {
  FakeClient,
  fakeDocumentKind,
  record
} from "../helpers/rooms.ts";
import {
  TAGGED_ASSET_ID,
  assetTag,
  fakeTags
} from "../helpers/session/catalog.ts";
import { createToolbarArchives } from "../helpers/session/archives.ts";
import {
  mountToolbar as mount,
  pick,
  query
} from "../helpers/ui/toolbar.ts";

function tour(
  id: string
): Tour {
  return new Tour({
    id,
    version: 1,
    title: `Tour ${id}`,
    steps: [
      {
        id: "welcome",
        title: "Welcome",
        body: ""
      }
    ]
  });
}

describe("EditorToolbar", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  test("hides itself when the session offers neither targets nor tags", async() => {
    const element = await mount(null, null);

    assert.ok(element.hasAttribute("empty"));
  });

  test("shows Offline while the server is unreachable, and says when changes wait", async() => {
    const client = Object.assign(
      new Emitter<{ ready: () => void; disconnected: () => void; }>(),
      { ready: true }
    );
    const assets = new AssetLeases({
      rooms: new FakeClient(),
      records: {
        record: (assetId) => record(assetId, "pixelart")
      }
    });
    const kind = fakeDocumentKind("pixelart");
    const element = document.createElement("jolly-editor-toolbar");
    element.sources = new EditorToolbarSources({
      targets: null,
      tags: null,
      archives: createToolbarArchives(),
      connectionStatus: new ConnectionStatus({ client, changes: assets }),
      lantern: new Lantern({ storage: new MemoryStorageAdapter() })
    });
    document.body.append(element);
    await element.updateComplete;
    assert.ok(element.hasAttribute("empty"));

    client.emit("disconnected");
    await element.updateComplete;
    assert.ok(!element.hasAttribute("empty"));
    assert.equal(query(element, ".offline")?.title, "Reconnecting to the server");

    assets.open(kind, "tex");
    kind.documents[0].changes.edit();
    await element.updateComplete;
    assert.match(query(element, ".offline")?.title ?? "", /kept in this browser/);

    client.emit("ready");
    await element.updateComplete;
    assert.equal(query(element, ".offline"), null);
    assert.ok(element.hasAttribute("empty"));
  });

  test("shows the bar for tours alone, and starts the only tour from the replay target", async() => {
    const lantern = new Lantern({ storage: new MemoryStorageAdapter() });
    const basics = tour("basics");
    const release = lantern.register(basics);
    const element = await mount(null, null, { lantern });

    const button = new TargetPath(REPLAY_TOUR_STEP.target).resolve(document);
    assert.ok(button instanceof HTMLElement);
    button.click();

    assert.ok(!element.hasAttribute("empty"));
    assert.equal(lantern.current?.tour, basics);

    lantern.current?.skip();
    release();
    await element.updateComplete;
    assert.ok(element.hasAttribute("empty"));
    assert.equal(query(element, "[data-tour=tours]"), null);
  });

  test("lists several tours in a menu with a check on the ones taken", async() => {
    const lantern = new Lantern({ storage: new MemoryStorageAdapter() });
    const basics = tour("basics");
    lantern.register(basics);
    lantern.register(tour("brushes"));
    lantern.seen.record(basics);
    const element = await mount(null, null, { lantern });
    const menu = query<ContextMenu>(element, "#tours-menu")!;

    query(element, "[data-tour=tours]")!.click();
    menu.dispatchEvent(new CustomEvent("jolly-context-action", {
      detail: { id: "brushes" }
    }));

    assert.deepEqual(menu.items, [
      {
        id: "basics",
        label: "Tour basics",
        icon: "check"
      },
      {
        id: "brushes",
        label: "Tour brushes"
      }
    ]);
    assert.equal(lantern.current?.tour.id, "brushes");
  });

  test("lists the current version, then tags and restore points, and views the picked one", async() => {
    const { catalog, navigator, tags } = fakeTags();
    catalog.stored = [assetTag("v1", 2), assetTag("restore/4", 4)];
    const element = await mount(null, tags);
    const versions = query<Select<string>>(element, ".version jolly-select")!;

    pick(versions, "v1");

    assert.deepEqual(
      versions.options.map((option) => option.value),
      ["", "v1", "restore/4"]
    );
    assert.ok(query(element, "#save-version"));
    assert.deepEqual(navigator.navigations, [
      {
        target: TAGGED_ASSET_ID,
        tag: "v1"
      }
    ]);
  });

  test("a viewed version is read-only and the current version leads back", async() => {
    const { navigator, tags } = fakeTags({ viewing: "v1" });
    const element = await mount(null, tags);

    pick(query(element, ".version jolly-select")!, "");

    assert.equal(query(element, "#save-version"), null);
    assert.ok(query(element, "#restore-version"));
    assert.equal(query(element, ".read-only")?.textContent, "Read-only");
    assert.deepEqual(navigator.navigations, [
      {
        target: TAGGED_ASSET_ID,
        tag: null
      }
    ]);
  });
});
