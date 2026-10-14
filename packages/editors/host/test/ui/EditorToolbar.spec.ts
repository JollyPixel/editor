// Import Node.js Dependencies
import {
  afterEach,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";

// Import Third-party Dependencies
import type { Select } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { EditorToolbar } from "#src/ui/index.ts";
import "#src/ui/index.ts";
import { EditorTargets } from "#src/session/EditorTargets.ts";
import type { EditorTags } from "#src/session/EditorTags.ts";
import { EditorToolbarSources } from "#src/session/EditorToolbarSources.ts";
import { record } from "../helpers/rooms.ts";
import {
  TAGGED_ASSET_ID,
  assetTag,
  FakeNavigator,
  fakeTags
} from "../helpers/session/catalog.ts";

async function mount(
  targets: EditorTargets | null,
  tags: EditorTags | null
): Promise<EditorToolbar> {
  const element = document.createElement("jolly-editor-toolbar");
  element.sources = new EditorToolbarSources(targets, tags);
  document.body.append(element);
  await setTimeout();
  await element.updateComplete;

  return element;
}

function query<TElement extends Element = HTMLElement>(
  element: EditorToolbar,
  selector: string
): TElement | null {
  return element.shadowRoot!.querySelector<TElement>(selector);
}

function pick(
  select: Element,
  value: string
): void {
  select.dispatchEvent(new CustomEvent("jolly-change", {
    detail: { value }
  }));
}

describe("EditorToolbar", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  test("hides itself when the session offers neither targets nor tags", async() => {
    const element = await mount(null, null);

    assert.ok(element.hasAttribute("empty"));
  });

  test("hides the Asset select when the target is the only asset of its kind", async() => {
    function targets(): EditorTargets {
      return new EditorTargets({
        catalog: {
          records: () => [record("forest", "voxelmap"), record("hero", "voxelmodel")].values(),
          subscribe: () => () => undefined
        },
        accepts: "voxelmap",
        current: "forest",
        navigator: new FakeNavigator()
      });
    }

    const alone = await mount(targets(), null);
    const tagged = await mount(targets(), fakeTags().tags);

    assert.ok(alone.hasAttribute("empty"));
    assert.ok(!tagged.hasAttribute("empty"));
    assert.equal(query(tagged, ".asset"), null);
    assert.ok(query(tagged, ".version"));
  });

  test("lists assets by path without extension and opens the picked one", async() => {
    const navigator = new FakeNavigator();
    const cave = {
      ...record("cave", "voxelmap"),
      source: "maps/cave.voxelmap.json"
    };
    const targets = new EditorTargets({
      catalog: {
        records: () => [record("forest", "voxelmap"), cave].values(),
        subscribe: () => () => undefined
      },
      accepts: "voxelmap",
      current: "forest",
      navigator
    });
    const element = await mount(targets, null);
    const assets = query<Select<string>>(element, ".asset jolly-select")!;

    pick(assets, "cave");

    assert.ok(!element.hasAttribute("empty"));
    assert.deepEqual(
      assets.options.map((option) => option.label),
      ["forest", "maps/cave"]
    );
    assert.deepEqual(navigator.navigations, [
      {
        target: "cave",
        tag: null
      }
    ]);
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
