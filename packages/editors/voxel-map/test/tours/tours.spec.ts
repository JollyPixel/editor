// Import Node.js Dependencies
import fs from "node:fs";
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  Lantern,
  TargetPath
} from "@jolly-pixel/lantern";
import {
  CAMERA_PREFERENCES,
  Preferences,
  provideTourKeys
} from "@jolly-pixel/editor.host";
import { PIXEL_ART_KEYBINDINGS } from "@jolly-pixel/editor.pixel-art/preferences";
import { MemoryStorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  MAP_TOURS,
  MAP_TOUR_KEYS,
  PIXEL_ART_TOUR_KEYS
} from "../../src/tours/mapTours.ts";
import { VOXEL_MAP_KEYBINDINGS } from "../../src/preferences.ts";

// CONSTANTS
const kPage = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const kKeyPlaceholder = /`\{([^{}\s]+)\}`/g;

describe("voxel-map tours", () => {
  test("every target path starts at an element of the page markup", () => {
    const body = /<body>([\s\S]*)<\/body>/.exec(kPage)?.[1] ?? "";
    document.body.innerHTML = body.replace(/<script[\s\S]*?<\/script>/g, "");

    for (const tour of MAP_TOURS) {
      for (const step of tour) {
        if (step.target instanceof TargetPath) {
          const [host] = step.target.selectors;

          assert.ok(
            document.querySelector(host),
            `${tour.id} step ${step.id} finds ${host}`
          );
        }
      }
    }
  });

  test("every key placeholder names a camera, map or pixel art binding", () => {
    const lantern = new Lantern({ storage: new MemoryStorageAdapter() });
    const preferences = new Preferences();
    const layout = { layout: null };
    provideTourKeys({
      lantern,
      preferences,
      scope: CAMERA_PREFERENCES,
      layout
    });
    provideTourKeys({
      lantern,
      preferences,
      scope: VOXEL_MAP_KEYBINDINGS,
      layout,
      namespace: MAP_TOUR_KEYS
    });
    provideTourKeys({
      lantern,
      preferences,
      scope: PIXEL_ART_KEYBINDINGS,
      layout,
      namespace: PIXEL_ART_TOUR_KEYS
    });

    for (const tour of MAP_TOURS) {
      for (const step of tour) {
        for (const [, name] of step.body.matchAll(kKeyPlaceholder)) {
          assert.ok(
            lantern.keys.labels(name)?.length,
            `${tour.id} step ${step.id} names a bound action: ${name}`
          );
        }
      }
    }
  });
});
