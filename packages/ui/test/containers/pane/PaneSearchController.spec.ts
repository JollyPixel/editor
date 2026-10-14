// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  PaneSearchController,
  type PaneSearchHost
} from "../../../src/containers/pane/PaneSearchController.ts";
import type { SearchQuery } from "../../../src/search/SearchQuery.ts";

interface Harness {
  controller: PaneSearchController;
  host: PaneSearchHost;
  announcements: string[];
  searches: string[];
  disable(): void;
}

function field(
  label: string
): HTMLElement {
  return Object.assign(document.createElement("div"), {
    label,
    applySearch(query: SearchQuery): number {
      return query.matches(label) ? 1 : 0;
    }
  });
}

function labelled(
  label: string
): HTMLElement {
  return Object.assign(document.createElement("div"), { label });
}

function searchable(
  matches: number,
  seen: string[] = []
): HTMLElement {
  return Object.assign(document.createElement("div"), {
    applySearch(query: SearchQuery): number {
      seen.push(query.text);

      return query.isEmpty ? 0 : matches;
    }
  });
}

function harness(
  content: Element[]
): Harness {
  let enabled = true;
  const host = Object.assign(document.createElement("div"), {
    addController: () => undefined,
    removeController: () => undefined,
    requestUpdate: () => undefined,
    updateComplete: Promise.resolve(true)
  });
  const announcements: string[] = [];
  const searches: string[] = [];
  host.addEventListener("jolly-search", (event) => {
    if (event instanceof CustomEvent) {
      searches.push(event.detail.query);
    }
  });

  return {
    controller: new PaneSearchController(host, {
      enabled: () => enabled,
      field: () => null,
      content: () => content,
      announce: (message) => announcements.push(message)
    }),
    host,
    announcements,
    searches,
    disable: () => {
      enabled = false;
    }
  };
}

function misses(
  elements: Element[]
): boolean[] {
  return elements.map((element) => element.hasAttribute("data-search-miss"));
}

describe("PaneSearchController", () => {
  test("marks searchable content that misses and leaves other elements alone, even labelled ones", () => {
    const content = [
      field("Position"),
      field("Rotation"),
      labelled("Apply"),
      document.createElement("div")
    ];
    const { controller } = harness(content);

    controller.search("pos");

    assert.deepEqual(misses(content), [false, true, false, false]);
  });

  test("clearing the query shows every element again", () => {
    const content = [field("Position"), field("Rotation")];
    const { controller } = harness(content);

    controller.search("pos");
    controller.search("");

    assert.deepEqual(misses(content), [false, false]);
  });

  test("hands the query to searchable content and hides it on zero matches", () => {
    const seen: string[] = [];
    const content = [searchable(3, seen), searchable(0)];
    const { controller, announcements } = harness(content);

    controller.search(" lamp ");

    assert.deepEqual(seen, ["lamp"]);
    assert.deepEqual(misses(content), [false, true]);
    assert.deepEqual(announcements, ["3 matches"]);
  });

  test("emits the trimmed query once per change", () => {
    const { controller, searches } = harness([field("Position")]);

    controller.search("pos");
    controller.search(" pos ");
    controller.search("");

    assert.deepEqual(searches, ["pos", ""]);
  });

  test("reports no matches only when some content took part", () => {
    const empty = harness([field("Position")]);
    empty.controller.search("zebra");

    assert.ok(empty.controller.noMatches);
    assert.deepEqual(empty.announcements, ["No matches"]);

    const opaque = harness([labelled("Apply")]);
    opaque.controller.search("zebra");

    assert.ok(!opaque.controller.noMatches);
    assert.deepEqual(opaque.announcements, []);
  });

  test("clears the search once the pane stops being searchable", () => {
    const content = [field("Position"), field("Rotation")];
    const { controller, searches, disable } = harness(content);

    controller.search("pos");
    disable();
    controller.hostUpdate();

    assert.deepEqual(searches, ["pos", ""]);
    assert.deepEqual(misses(content), [false, false]);
  });
});
