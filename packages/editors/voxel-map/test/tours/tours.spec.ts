// Import Node.js Dependencies
import fs from "node:fs";
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { TargetPath } from "@jolly-pixel/lantern";

// Import Internal Dependencies
import { basics } from "../../src/tours/basics.ts";
import { textures } from "../../src/tours/textures.ts";

// CONSTANTS
const kPage = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const kTours = [basics, textures];

describe("voxel-map tours", () => {
  test("every target path starts at an element of the page markup", () => {
    const body = /<body>([\s\S]*)<\/body>/.exec(kPage)?.[1] ?? "";
    document.body.innerHTML = body.replace(/<script[\s\S]*?<\/script>/g, "");

    for (const tour of kTours) {
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
});
