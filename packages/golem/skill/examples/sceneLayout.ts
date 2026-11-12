// Import Third-party Dependencies
import {
  Golem,
  type ActorSpec
} from "@jolly-pixel/golem";

// CONSTANTS
const kBatchSize = 200;
const kRows = 10;
const kSpacing = 3;

const [assetId] = process.argv.slice(2);
if (assetId === undefined) {
  throw new TypeError("Usage: script_run sceneLayout.ts <scene asset id>");
}

using golem = await Golem.connect();
const tag = `before-grid-${Date.now()}`;
await golem.catalog.tag(assetId, tag);
const scene = await golem.open(assetId, "scene");

const pillars = Array.from({ length: kRows * kRows }, (_, index): ActorSpec => {
  return {
    name: `Pillar ${index + 1}`,
    transform: {
      position: {
        x: (index % kRows) * kSpacing,
        y: 0,
        z: Math.floor(index / kRows) * kSpacing
      },
      scale: {
        x: 1,
        y: 1 + Math.random() * 2,
        z: 1
      }
    }
  };
});

try {
  for (let start = 0; start < pillars.length; start += kBatchSize) {
    golem.activity(scene, {
      label: `Placing ${pillars.length} pillars`,
      progress: start / pillars.length
    });
    await scene.addActors(pillars.slice(start, start + kBatchSize));
  }
  await scene.settled();
}
catch (error) {
  await golem.catalog.restore(assetId, tag);

  throw error;
}
finally {
  golem.clearActivity();
}
