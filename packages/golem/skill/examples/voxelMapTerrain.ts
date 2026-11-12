// Import Third-party Dependencies
import {
  Golem,
  type VoxelWrite
} from "@jolly-pixel/golem";

// CONSTANTS
const kSize = 32;

const [assetId, block = "grass", layer = "Ground"] = process.argv.slice(2);
if (assetId === undefined) {
  throw new TypeError(
    "Usage: script_run voxelMapTerrain.ts <voxel map asset id> [block] [layer]"
  );
}

using golem = await Golem.connect();
const tag = `before-terrain-${Date.now()}`;
await golem.catalog.tag(assetId, tag);
const map = await golem.open(assetId, "voxelmap");

const voxels: VoxelWrite[] = [];
for (let x = 0; x < kSize; x++) {
  for (let z = 0; z < kSize; z++) {
    const height = Math.round(3 + (2 * Math.sin(x / 5)) + (2 * Math.cos(z / 7)));
    for (let y = 0; y <= height; y++) {
      voxels.push({
        position: { x, y, z },
        block
      });
    }
  }
}

try {
  golem.activity(map, {
    label: `Raising a ${kSize} by ${kSize} terrain`
  });
  await map.writeVoxels(voxels, { layer });
  await map.settled();
}
catch (error) {
  await golem.catalog.restore(assetId, tag);

  throw error;
}
finally {
  golem.clearActivity();
}
